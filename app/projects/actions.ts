'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import {
  transaction,
  ownerDb,
  pgErrorCode,
  projects,
  projectInvitations,
  projectMembers,
  notifications,
} from '@/lib/db'
import { canCreateProjects, findInviteeByEmail, isProjectAdmin } from '@/lib/authz'
import { emitInvitationNotification } from '@/lib/notifications/invitation'
import { normalizeTaskType } from './task-types'

export type CreateProjectState = { error: string } | null

export type InviteEvaluatorState = { error: string } | { ok: string } | null

export type UpdateProjectState = { error: string } | { ok: string } | null

// HU-012/013: cria um projeto. A permissão é checada EXPLICITAMENTE na app-layer
// (`canCreateProjects`) ANTES da escrita. O INSERT do projeto vai via Drizzle; logo
// depois, a linha de Administrador ativo é criada EXPLICITAMENTE aqui (na app-layer, não
// mais por trigger). Ver ADR 0007.
export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const taskType = normalizeTaskType(String(formData.get('task_type') ?? ''))

  if (!name) return { error: 'Informe um nome para o projeto.' }

  // Sem a permissão de plataforma, nem tentamos o INSERT (a fatia 08 entrega o fluxo
  // de pedir permissão; por ora basta avisar).
  if (!(await canCreateProjects(userId))) {
    return {
      error:
        'Não foi possível criar o projeto. Verifique se você tem permissão para criar projetos.',
    }
  }

  const [created] = await transaction((tx) =>
    tx
      .insert(projects)
      .values({
        name,
        description: description || null,
        taskType,
        createdBy: userId,
      })
      .returning({ id: projects.id }),
  )

  // HU-012: materializa o criador como Administrador ativo. onConflictDoNothing mantém a
  // escrita idempotente (defensivo contra reenvio). Admin nasce já consentido/sem onboarding.
  await ownerDb
    .insert(projectMembers)
    .values({ projectId: created.id, userId, role: 'administrator', status: 'active' })
    .onConflictDoNothing({
      target: [projectMembers.projectId, projectMembers.userId, projectMembers.role],
    })

  // redirect lança a exceção de controle do Next — fica FORA do transaction p/ não
  // abortar a transação por engano.
  redirect(`/projects/${created.id}`)
}

// Regex propositalmente frouxa: só barra digitação obviamente inválida antes de
// gravar; a validação real do endereço é o próprio login com Google (ADR 0006).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// HU-010 / HU-018 / ADR 0006: o Administrador convida um avaliador por e-mail —
// mesmo que a pessoa AINDA NÃO tenha conta. findInviteeByEmail (lib/authz) devolve só
// id+name sem enumerar e-mails: a guarda anti-enumeração (só resolve se quem convida tem
// can_create_projects) vive em TS.
//
// A permissão de admin é checada EXPLICITAMENTE na app (`isProjectAdmin`) ANTES das
// queries. Dois caminhos:
//  - JÁ CADASTRADO: grava invitee_id + invitee_email; pré-check de membro ativo (mensagem
//    amigável); a notificação in-platform é criada EXPLICITAMENTE aqui.
//  - SEM CONTA: grava só invitee_email (invitee_id NULL). O convite fica pendente até o
//    1º login com Google daquele e-mail, quando o provisionamento (lib/auth/provision)
//    vincula o invitee_id e dispara a notificação (fatia 07 / ADR 0006). O admin
//    compartilha o link por fora.
//
// O índice único (inv_one_pending_per_invitee / inv_one_pending_per_email) barra convite
// pendente duplicado (23505) nos dois caminhos.
export async function inviteEvaluator(
  _prev: InviteEvaluatorState,
  formData: FormData,
): Promise<InviteEvaluatorState> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()

  if (!projectId) return { error: 'Projeto inválido.' }
  if (!email) return { error: 'Informe o e-mail do avaliador.' }
  if (!EMAIL_RE.test(email)) return { error: 'Informe um e-mail válido.' }

  if (!(await isProjectAdmin(userId, projectId))) {
    return { error: 'Apenas o administrador do projeto pode convidar avaliadores.' }
  }

  const invitee = await findInviteeByEmail(userId, email)

  // Alvo do convite: quem se vê no sucesso e na mensagem de duplicado.
  const target = invitee ? invitee.name : email

  // Não convidar quem já é membro ativo (mensagem clara). Só faz sentido para quem já
  // tem conta — sem perfil não há membership.
  if (invitee) {
    const [active] = await transaction((tx) =>
      tx
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, invitee.id),
            eq(projectMembers.status, 'active'),
          ),
        )
        .limit(1),
    )
    if (active) {
      return { error: `${invitee.name} já é membro ativo deste projeto.` }
    }
  }

  let invitationId: string
  try {
    const [row] = await transaction((tx) =>
      tx
        .insert(projectInvitations)
        .values({
          projectId,
          inviteeId: invitee ? invitee.id : null,
          inviteeEmail: email,
          invitedBy: userId,
          status: 'pending',
        })
        .returning({ id: projectInvitations.id }),
    )
    invitationId = row.id
  } catch (err) {
    // 23505: índice único (convite pendente já existe para esse e-mail/usuário).
    if (pgErrorCode(err) === '23505') {
      return { error: `${target} já tem um convite pendente neste projeto.` }
    }
    // Demais: numa corrida, a pessoa pode ter virado membro ativo entre o pré-check e a
    // escrita.
    return {
      error: `Não foi possível convidar ${target}. Talvez já seja membro ativo do projeto.`,
    }
  }

  // Notificação in-platform do convite (só o ramo JÁ-CADASTRADO: quem não tem conta é
  // notificado na resolução, no 1º login — ver lib/auth/provision). A guarda not-exists
  // mantém a escrita idempotente (não duplica se a mesma notificação já existe).
  if (invitee) {
    const [dup] = await ownerDb
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, invitee.id),
          sql`${notifications.payload}->>'invitation_id' = ${invitationId}`,
        ),
      )
      .limit(1)
    if (!dup) {
      await emitInvitationNotification(ownerDb, {
        id: invitationId,
        userId: invitee.id,
        projectId,
        invitedBy: userId,
      })
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return invitee
    ? { ok: `Convite enviado para ${invitee.name}.` }
    : { ok: `Convite enviado para ${email}. A pessoa verá o convite ao entrar com o Google.` }
}

// HU-014/016: o Administrador edita nome/descrição — só com o projeto `active`. A
// permissão de admin é checada EXPLICITAMENTE na app (`isProjectAdmin`) ANTES da escrita.
// O `where status = 'active'` embutido no UPDATE evita a corrida (o projeto ser concluído
// entre a checagem e a escrita) — se casar 0 linhas, avisamos que está travado.
export async function updateProject(
  _prev: UpdateProjectState,
  formData: FormData,
): Promise<UpdateProjectState> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!projectId) return { error: 'Projeto inválido.' }
  if (!name) return { error: 'Informe um nome para o projeto.' }

  if (!(await isProjectAdmin(userId, projectId))) {
    return { error: 'Não foi possível salvar. Apenas o administrador edita, e só em projeto ativo.' }
  }

  const updated = await transaction((tx) =>
    tx
      .update(projects)
      .set({ name, description: description || null })
      .where(and(eq(projects.id, projectId), eq(projects.status, 'active')))
      .returning({ id: projects.id }),
  )

  if (updated.length === 0) {
    // Casou 0 linhas: o projeto não está `active` (foi concluído/arquivado) — read-only.
    return { error: 'Projeto concluído ou arquivado é somente leitura. Reative-o para editar.' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { ok: 'Alterações salvas.' }
}

// HU-015/016/017: transições do ciclo de vida do projeto pelo Administrador —
// concluir (active→completed), arquivar (active/completed→archived) e reativar
// (completed/archived→active). Ação sem estado: os botões da UI confirmam antes de
// enviar e só aparecem nas transições válidas para o status atual. A permissão de admin
// é checada EXPLICITAMENTE (`isProjectAdmin`). O `where status = <origem>` embutido torna
// a transição idempotente e imune à corrida.
const STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  active: ['completed', 'archived'],
  completed: ['active', 'archived'],
  archived: ['active'],
}

export async function setProjectStatus(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  const from = String(formData.get('from') ?? '')
  const to = String(formData.get('to') ?? '')
  if (!projectId) return

  // Transição precisa ser conhecida e permitida a partir do status de origem declarado.
  if (!STATUS_TRANSITIONS[from]?.includes(to)) return

  if (!(await isProjectAdmin(userId, projectId))) return

  await transaction((tx) =>
    tx
      .update(projects)
      .set({ status: to })
      .where(and(eq(projects.id, projectId), eq(projects.status, from))),
  )

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
}

// HU-021: o Administrador remove um avaliador do projeto. status → 'inactive'
// (as avaliações são preservadas — nada é apagado), e os convites pendentes daquele
// avaliador para o projeto são cancelados. Sem notificação ao removido. A permissão de
// admin é checada EXPLICITAMENTE (`isProjectAdmin`) antes da escrita. Numa única transação:
//   • a checagem `isProjectAdmin` + o filtro `role='evaluator' AND status='active'` são a
//     guarda da transição active→inactive de OUTRO membro;
//   • cancelar os convites pendentes daquele avaliador.
// O filtro `status = 'active'` evita mexer em avaliador ainda em onboarding e torna a ação
// idempotente. Reativar-se (inactive→active) não é oferecido por nenhuma action.
export async function removeMember(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  const memberUserId = String(formData.get('member_user_id') ?? '')
  if (!projectId || !memberUserId) return

  if (!(await isProjectAdmin(userId, projectId))) return

  await transaction(async (tx) => {
    // `updated_at` não é setado aqui: o `$onUpdate` do schema (lib/db/schema.ts) já o
    // mantém automaticamente em todo UPDATE.
    await tx
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, memberUserId),
          eq(projectMembers.role, 'evaluator'),
          eq(projectMembers.status, 'active'),
        ),
      )

    await tx
      .update(projectInvitations)
      .set({ status: 'cancelled', resolvedAt: new Date().toISOString() })
      .where(
        and(
          eq(projectInvitations.projectId, projectId),
          eq(projectInvitations.inviteeId, memberUserId),
          eq(projectInvitations.status, 'pending'),
        ),
      )
  })

  revalidatePath(`/projects/${projectId}`)
}

// HU-022: o Avaliador sai voluntariamente do projeto. status → 'inactive' na PRÓPRIA
// linha de avaliador ativo; avaliações preservadas. A guarda é o próprio filtro
// `user_id = self AND role='evaluator' AND status='active'`: só a própria linha ativa
// vira inactive, e nunca o contrário. Reativar-se (inactive→active) não é oferecido por
// nenhuma action. Redireciona ao dashboard (já não é mais membro ativo aqui).
export async function leaveProject(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return

  // `updated_at` não é setado aqui (ver removeMember): o `$onUpdate` do schema cuida disso.
  await transaction((tx) =>
    tx
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
          eq(projectMembers.role, 'evaluator'),
          eq(projectMembers.status, 'active'),
        ),
      ),
  )

  // redirect lança a exceção de controle do Next — fica FORA do transaction.
  revalidatePath('/dashboard')
  redirect('/dashboard')
}
