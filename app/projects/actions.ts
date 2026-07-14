'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { withUser, pgErrorCode, projects, projectInvitations, projectMembers } from '@/lib/db'
import { canCreateProjects, isProjectAdmin } from '@/lib/authz'
import { normalizeTaskType } from './task-types'

export type CreateProjectState = { error: string } | null

export type InviteEvaluatorState = { error: string } | { ok: string } | null

export type UpdateProjectState = { error: string } | { ok: string } | null

// HU-012/013: cria um projeto. A checagem de permissão agora é EXPLÍCITA na app
// (`canCreateProjects`, espelha o predicado da policy projects_insert), feita ANTES
// da escrita — a RLS segue ligada como backstop enquanto não fazemos o flip (issue #22).
// O INSERT vai via Drizzle sob `withUser` (papel `authenticated`); o criador se enxerga
// por created_by (migration 0005). O trigger auto_add_creator_as_admin (AFTER INSERT,
// security definer) materializa a linha de Administrador ativo — segue no banco porque
// movê-lo p/ cá exigiria abrir a policy pm_insert (Fase 4). Ver ADR 0007.
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

  const [created] = await withUser(userId, (tx) =>
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

  // redirect lança a exceção de controle do Next — fica FORA do withUser p/ não
  // abortar a transação (e os passos do trigger) por engano.
  redirect(`/projects/${created.id}`)
}

// Regex propositalmente frouxa: só barra digitação obviamente inválida antes de
// gravar; a validação real do endereço é o próprio login com Google (ADR 0006).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// HU-010 / HU-018 / ADR 0006: o Administrador convida um avaliador por e-mail —
// mesmo que a pessoa AINDA NÃO tenha conta. find_invitee_by_email (RPC security
// definer) devolve só id+name sem enumerar e-mails; por decisão da Fase 4 (ADR 0007)
// PERMANECE em SQL (fronteira anti-enumeração, garantida pelo banco) e é chamada via
// Drizzle sob `withUser`, com auth.uid() resolvido pela claim da transação.
//
// A permissão de admin agora é checada EXPLICITAMENTE na app (`isProjectAdmin`, espelha
// o predicado de inv_insert) ANTES das queries; a RLS segue como backstop até o flip.
// Dois caminhos:
//  - JÁ CADASTRADO: grava invitee_id + invitee_email; pré-check de membro ativo
//    reimplementa check_invitation_target (mensagem amigável, o trigger segue no banco
//    como rede); notify_on_invitation cria a notificação in-platform na hora.
//  - SEM CONTA: grava só invitee_email (invitee_id NULL). O convite fica pendente até o
//    1º login com Google daquele e-mail, quando handle_new_user vincula o invitee_id e
//    dispara a notificação (fatia 07 / ADR 0006). O admin compartilha o link por fora.
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

  const [invitee] = await withUser(userId, (tx) =>
    tx.execute<{ id: string; name: string }>(
      sql`select id, name from public.find_invitee_by_email(${email})`,
    ),
  )

  // Alvo do convite: quem se vê no sucesso e na mensagem de duplicado.
  const target = invitee ? invitee.name : email

  // check_invitation_target em TS: não convidar quem já é membro ativo (mensagem
  // clara). Só faz sentido para quem já tem conta — sem perfil não há membership.
  if (invitee) {
    const [active] = await withUser(userId, (tx) =>
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

  try {
    await withUser(userId, (tx) =>
      tx.insert(projectInvitations).values({
        projectId,
        inviteeId: invitee ? invitee.id : null,
        inviteeEmail: email,
        invitedBy: userId,
        status: 'pending',
      }),
    )
  } catch (err) {
    // 23505: índice único (convite pendente já existe para esse e-mail/usuário).
    if (pgErrorCode(err) === '23505') {
      return { error: `${target} já tem um convite pendente neste projeto.` }
    }
    // Demais (P0001 do trigger check_invitation_target como rede, p/ corrida): a pessoa
    // virou membro ativo entre o pré-check e a escrita.
    return {
      error: `Não foi possível convidar ${target}. Talvez já seja membro ativo do projeto.`,
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return invitee
    ? { ok: `Convite enviado para ${invitee.name}.` }
    : { ok: `Convite enviado para ${email}. A pessoa verá o convite ao entrar com o Google.` }
}

// HU-014/016: o Administrador edita nome/descrição — só com o projeto `active`. A
// permissão de admin agora é checada EXPLICITAMENTE na app (`isProjectAdmin`, espelha
// projects_update) ANTES da escrita; a RLS segue como backstop. O `where status = 'active'`
// embutido no UPDATE evita a corrida (o projeto ser concluído entre a checagem e a
// escrita) — se casar 0 linhas, avisamos que está travado (enforce_project_readonly segue
// como rede no banco para completed/archived).
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

  const updated = await withUser(userId, (tx) =>
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
// é checada EXPLICITAMENTE (`isProjectAdmin`, espelha projects_update); a RLS segue como
// backstop. O `where status = <origem>` embutido torna a transição idempotente e imune à
// corrida. enforce_project_readonly não barra (só nome/descrição).
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

  await withUser(userId, (tx) =>
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
// admin é checada EXPLICITAMENTE (`isProjectAdmin`) antes da escrita; a RLS segue como
// backstop. Numa única transação sob `withUser`:
//   • a checagem `isProjectAdmin` + o filtro `role='evaluator' AND status='active'` são a
//     guarda PRIMÁRIA da transição active→inactive de OUTRO membro (issue #22, Fase 2);
//     enforce_member_status_transition (ramo admin) segue no banco como backstop até o flip;
//   • inv_update (is_project_admin) autoriza cancelar os convites pendentes.
// O filtro `status = 'active'` evita mexer em avaliador ainda em onboarding (cuja
// linha inactive violaria o CHECK pm_consent_required) e torna a ação idempotente.
// O furo "removido reativa a própria linha (inactive→active)" fica fechado na app pela
// AUSÊNCIA de qualquer caminho que faça inactive→active (nenhuma action o oferece) —
// enforce_member_status_transition é só rede enquanto a RLS está ligada.
export async function removeMember(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  const memberUserId = String(formData.get('member_user_id') ?? '')
  if (!projectId || !memberUserId) return

  if (!(await isProjectAdmin(userId, projectId))) return

  await withUser(userId, async (tx) => {
    // `updated_at` NÃO é setado aqui: a coluna não está no grant de UPDATE do papel
    // `authenticated` (seção 5 da 0002 — só status/consent/onboarding), e o trigger
    // project_members_set_updated_at já a mantém. Setá-la daria 42501 (permission denied).
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
// linha de avaliador ativo; avaliações preservadas. A guarda PRIMÁRIA é o próprio filtro
// `user_id = self AND role='evaluator' AND status='active'` (issue #22, Fase 2): só a
// própria linha ativa vira inactive, e nunca o contrário. enforce_member_status_transition
// (ramo do próprio membro: pending→active e active→inactive) segue como backstop até o
// flip. Reativar-se (inactive→active) não é oferecido por nenhuma action.
// Redireciona ao dashboard (já não é mais membro ativo aqui).
export async function leaveProject(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return

  // `updated_at` NÃO é setado aqui (ver removeMember): fora do grant de UPDATE do
  // papel `authenticated`; o trigger project_members_set_updated_at cuida disso.
  await withUser(userId, (tx) =>
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

  // redirect lança a exceção de controle do Next — fica FORA do withUser.
  revalidatePath('/dashboard')
  redirect('/dashboard')
}
