'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { withUser, pgErrorCode, projects, projectInvitations, projectMembers } from '@/lib/db'
import { normalizeTaskType } from './task-types'

export type CreateProjectState = { error: string } | null

export type InviteEvaluatorState = { error: string } | { ok: string } | null

// HU-012/013: cria um projeto via Drizzle sob `withUser` (papel `authenticated`),
// então a RLS (projects_insert, exige can_create_projects) continua valendo. O
// INSERT ... RETURNING revalida projects_select; o criador se enxerga por created_by
// (migration 0005), sem depender do trigger. O trigger auto_add_creator_as_admin
// (AFTER INSERT, security definer) materializa a linha de Administrador ativo — segue
// no banco porque movê-lo p/ cá exigiria abrir a policy pm_insert (Fase 5). Ver ADR 0007.
export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const taskType = normalizeTaskType(String(formData.get('task_type') ?? ''))

  if (!name) return { error: 'Informe um nome para o projeto.' }

  let projectId: string
  try {
    const [created] = await withUser(user.id, (tx) =>
      tx
        .insert(projects)
        .values({
          name,
          description: description || null,
          taskType,
          createdBy: user.id,
        })
        .returning({ id: projects.id }),
    )
    projectId = created.id
  } catch {
    // Sem can_create_projects, a RLS barra o INSERT (a fatia 08 entrega o fluxo de
    // pedir permissão; por ora basta avisar).
    return {
      error:
        'Não foi possível criar o projeto. Verifique se você tem permissão para criar projetos.',
    }
  }

  // redirect lança a exceção de controle do Next — fica FORA do withUser p/ não
  // abortar a transação (e os passos do trigger) por engano.
  redirect(`/projects/${projectId}`)
}

// HU-018 (parcial) / HU-010: o Administrador convida um avaliador JÁ CADASTRADO pelo
// e-mail. find_invitee_by_email (RPC security definer) devolve só id+name sem enumerar
// e-mails — por decisão da Fase 4 (ADR 0007) PERMANECE em SQL (é a fronteira anti-
// enumeração, garantida pelo banco) e passa a ser chamada via Drizzle sob `withUser`,
// não mais por supabase.rpc; o auth.uid() interno resolve pela claim da transação. O
// INSERT do convite vai por Drizzle sob `withUser`: a RLS (inv_insert, exige
// is_project_admin) vale; o pré-check de membro ativo reimplementa check_invitation_target
// (mensagem amigável) e o trigger homônimo segue no banco como rede; o índice único barra
// convite pendente duplicado (23505); notify_on_invitation cria a notificação in-platform
// (AFTER INSERT, fica no banco: notifications não tem policy de INSERT). Convidar quem não
// tem conta é a fatia 07.
export async function inviteEvaluator(
  _prev: InviteEvaluatorState,
  formData: FormData,
): Promise<InviteEvaluatorState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = String(formData.get('project_id') ?? '')
  const email = String(formData.get('email') ?? '').trim()

  if (!projectId) return { error: 'Projeto inválido.' }
  if (!email) return { error: 'Informe o e-mail do avaliador.' }

  const [invitee] = await withUser(user.id, (tx) =>
    tx.execute<{ id: string; name: string }>(
      sql`select id, name from public.find_invitee_by_email(${email})`,
    ),
  )

  if (!invitee) {
    return {
      error:
        'Nenhum usuário cadastrado com esse e-mail. Por enquanto só é possível convidar quem já entrou ao menos uma vez.',
    }
  }

  // check_invitation_target em TS: não convidar quem já é membro ativo (mensagem
  // clara). Sob `withUser`, o admin enxerga os membros do projeto (pm_select).
  const [active] = await withUser(user.id, (tx) =>
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

  try {
    await withUser(user.id, (tx) =>
      tx.insert(projectInvitations).values({
        projectId,
        inviteeId: invitee.id,
        invitedBy: user.id,
        status: 'pending',
      }),
    )
  } catch (err) {
    // 23505: índice único (convite pendente já existe).
    if (pgErrorCode(err) === '23505') {
      return { error: `${invitee.name} já tem um convite pendente neste projeto.` }
    }
    // Demais (P0001 do trigger check_invitation_target como rede, p/ corrida; ou RLS
    // negando): já é membro ativo ou sem permissão de admin.
    return {
      error: `Não foi possível convidar ${invitee.name}. Talvez já seja membro ativo do projeto.`,
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return { ok: `Convite enviado para ${invitee.name}.` }
}
