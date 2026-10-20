'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import {
  transaction,
  ownerDb,
  pgErrorCode,
  projects,
  projectInvitations,
  projectMembers,
  platformPermissionRequests,
  notifications,
  type DbExecutor,
} from '@/lib/db'
import {
  canCreateProjects,
  countSubmittedEvaluations,
  findInviteeByEmail,
  isProjectAdmin,
} from '@/lib/authz'
import { emitInvitationNotification } from '@/lib/notifications/invitation'
import { normalizeTaskType } from './task-types'
import {
  ASSUME_ALREADY_EVALUATOR,
  assumeEvaluatorRefusal,
  evaluatorLinkOf,
  revokeEvaluatorRefusal,
  type EvaluatorRoleView,
} from './evaluator-link'
import { grantAdminRefusal, revokeAdminOutcome, revokeAdminRefusal } from './admin-role'
import { EMAIL_MAX, PROJECT_DESCRIPTION_MAX, PROJECT_NAME_MAX } from '@/lib/limits'

export type CreateProjectState = { error: string } | null

export type RequestPermissionState = { error: string } | { ok: string } | null

export type InviteEvaluatorState = { error: string } | { ok: string } | null

export type UpdateProjectState = { error: string } | { ok: string } | null

export type EvaluatorRoleState = { error: string } | { ok: string } | null

export type GrantAdminState = { error: string } | { ok: string } | null

export type RevokeAdminState = { error: string } | { ok: string } | null


export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const userId = await requireUserId()

  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const taskType = normalizeTaskType(String(formData.get('task_type') ?? ''))

  if (!name) return { error: 'Informe um nome para o projeto.' }
  if (name.length > PROJECT_NAME_MAX) {
    return { error: `O nome pode ter no máximo ${PROJECT_NAME_MAX} caracteres.` }
  }
  if (description.length > PROJECT_DESCRIPTION_MAX) {
    return { error: `A descrição pode ter no máximo ${PROJECT_DESCRIPTION_MAX} caracteres.` }
  }

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

  await ownerDb
    .insert(projectMembers)
    .values({ projectId: created.id, userId, role: 'administrator', status: 'active' })
    .onConflictDoNothing({
      target: [projectMembers.projectId, projectMembers.userId, projectMembers.role],
    })


  redirect(`/projects/${created.id}`)
}


export async function requestCreatePermission(
  _prev: RequestPermissionState,
  _formData: FormData,
): Promise<RequestPermissionState> {
  const userId = await requireUserId()

  if (await canCreateProjects(userId)) {
    return { ok: 'Você já tem permissão para criar projetos.' }
  }

  await transaction((tx) =>
    tx
      .insert(platformPermissionRequests)
      .values({ userId, status: 'pending' })
      .onConflictDoNothing(),
  )

  revalidatePath('/projects/new')
  return { ok: 'Solicitação enviada. Você será avisado quando for analisada.' }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/


export async function inviteEvaluator(
  _prev: InviteEvaluatorState,
  formData: FormData,
): Promise<InviteEvaluatorState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()

  if (!projectId) return { error: 'Projeto inválido.' }
  if (!email) return { error: 'Informe o e-mail do avaliador.' }
  if (email.length > EMAIL_MAX) {
    return { error: `O e-mail pode ter no máximo ${EMAIL_MAX} caracteres.` }
  }
  if (!EMAIL_RE.test(email)) return { error: 'Informe um e-mail válido.' }

  if (!(await isProjectAdmin(userId, projectId))) {
    return { error: 'Apenas um administrador do projeto pode convidar avaliadores.' }
  }

  const invitee = await findInviteeByEmail(userId, projectId, email)

  const target = invitee ? invitee.name : email

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
    if (pgErrorCode(err) === '23505') {
      return { error: `${target} já tem um convite pendente neste projeto.` }
    }

    console.error('inviteEvaluator falhou:', err)
    return {
      error: `Não foi possível convidar ${target}. Talvez já seja membro ativo do projeto.`,
    }
  }

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
    : { ok: `Convite enviado para ${email}.` }
}


export async function updateProject(
  _prev: UpdateProjectState,
  formData: FormData,
): Promise<UpdateProjectState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!projectId) return { error: 'Projeto inválido.' }
  if (!name) return { error: 'Informe um nome para o projeto.' }
  if (name.length > PROJECT_NAME_MAX) {
    return { error: `O nome pode ter no máximo ${PROJECT_NAME_MAX} caracteres.` }
  }
  if (description.length > PROJECT_DESCRIPTION_MAX) {
    return { error: `A descrição pode ter no máximo ${PROJECT_DESCRIPTION_MAX} caracteres.` }
  }

  if (!(await isProjectAdmin(userId, projectId))) {
    return { error: 'Não foi possível salvar. Apenas um administrador edita, e só em projeto ativo.' }
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

const STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  active: ['completed', 'archived'],
  completed: ['active', 'archived'],
  archived: ['active'],
}

export async function setProjectStatus(formData: FormData): Promise<void> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const from = String(formData.get('from') ?? '')
  const to = String(formData.get('to') ?? '')
  if (!projectId) return

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

export async function deactivateMember(formData: FormData): Promise<void> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const memberUserId = String(formData.get('member_user_id') ?? '')
  if (!projectId || !memberUserId) return

  if (!(await isProjectAdmin(userId, projectId))) return

  await transaction(async (tx) => {

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

export async function leaveProject(formData: FormData): Promise<void> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return


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


  revalidatePath('/dashboard')
  redirect('/dashboard')
}

async function membershipRowsOf(userId: string, projectId: string, db: DbExecutor) {
  return db
    .select({ role: projectMembers.role, status: projectMembers.status })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
}

async function evaluatorRoleView(
  userId: string,
  projectId: string,
  db: DbExecutor,
): Promise<EvaluatorRoleView> {
  const memberships = await membershipRowsOf(userId, projectId, db)

  return {
    isAdmin: await isProjectAdmin(userId, projectId, db),
    link: evaluatorLinkOf(memberships, await countSubmittedEvaluations(userId, projectId, db)),
  }
}

export async function assumeEvaluatorRole(
  _prev: EvaluatorRoleState,
  formData: FormData,
): Promise<EvaluatorRoleState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  let refusal: string | null
  try {
    refusal = await transaction(async (tx) => {
      const view = await evaluatorRoleView(userId, projectId, tx)
      const refused = assumeEvaluatorRefusal(view)
      if (refused) return refused

      if (view.link) {
        await tx
          .update(projectMembers)
          .set({ status: 'pending_onboarding' })
          .where(
            and(
              eq(projectMembers.projectId, projectId),
              eq(projectMembers.userId, userId),
              eq(projectMembers.role, 'evaluator'),
              eq(projectMembers.status, 'inactive'),
            ),
          )
        return null
      }

      await tx.insert(projectMembers).values({
        projectId,
        userId,
        role: 'evaluator',
        status: 'pending_onboarding',
      })
      return null
    })
  } catch (err) {
    if (pgErrorCode(err) === '23505') return { error: ASSUME_ALREADY_EVALUATOR }

    console.error('assumeEvaluatorRole falhou:', err)
    return { error: 'Não foi possível assumir o papel de avaliador. Tente de novo.' }
  }

  if (refusal) return { error: refusal }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/members`)
  revalidatePath('/dashboard')
  redirect(`/projects/${projectId}/onboarding`)
}

export async function revokeEvaluatorRole(
  _prev: EvaluatorRoleState,
  formData: FormData,
): Promise<EvaluatorRoleState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  const refusal = await transaction(async (tx) => {
    const refused = revokeEvaluatorRefusal(await evaluatorRoleView(userId, projectId, tx))
    if (refused) return refused

    await tx
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
          eq(projectMembers.role, 'evaluator'),
        ),
      )
    return null
  })

  if (refusal) return { error: refusal }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/members`)
  revalidatePath('/dashboard')
  return {
    ok: 'Você deixou de participar como avaliador. Seu acesso de administrador continua o mesmo.',
  }
}

function revalidateMembership(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/members`)
  revalidatePath('/dashboard')
}

export async function grantAdminRole(
  _prev: GrantAdminState,
  formData: FormData,
): Promise<GrantAdminState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const memberUserId = String(formData.get('member_user_id') ?? '')
  if (!projectId || !memberUserId) return { error: 'Projeto inválido.' }

  const refusal = await transaction(async (tx) => {
    const refused = grantAdminRefusal({
      callerIsAdmin: await isProjectAdmin(userId, projectId, tx),
      target: await membershipRowsOf(memberUserId, projectId, tx),
    })
    if (refused) return refused

    await tx
      .insert(projectMembers)
      .values({ projectId, userId: memberUserId, role: 'administrator', status: 'active' })
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.userId, projectMembers.role],
        set: { status: 'active' },
      })
    return null
  })

  if (refusal) return { error: refusal }

  revalidateMembership(projectId)
  return { ok: 'Acesso de administrador concedido.' }
}

export async function revokeAdminRole(
  _prev: RevokeAdminState,
  formData: FormData,
): Promise<RevokeAdminState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const memberUserId = String(formData.get('member_user_id') ?? '')
  if (!projectId || !memberUserId) return { error: 'Projeto inválido.' }

  const result = await transaction(async (tx) => {
    const activeAdmins = await tx
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.role, 'administrator'),
          eq(projectMembers.status, 'active'),
        ),
      )
      .for('update')

    const refused = revokeAdminRefusal({
      callerIsAdmin: activeAdmins.some((a) => a.userId === userId),
      targetIsAdmin: activeAdmins.some((a) => a.userId === memberUserId),
      activeAdminCount: activeAdmins.length,
    })
    if (refused) return { refusal: refused }

    await tx
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, memberUserId),
          eq(projectMembers.role, 'administrator'),
          eq(projectMembers.status, 'active'),
        ),
      )

    return {
      refusal: null,
      outcome: revokeAdminOutcome(await membershipRowsOf(memberUserId, projectId, tx)),
    }
  })

  if (result.refusal) return { error: result.refusal }

  revalidateMembership(projectId)
  if (memberUserId !== userId) return { ok: 'Acesso de administrador removido.' }
  if (result.outcome === 'loses_access') redirect('/dashboard')
  return { ok: 'Você deixou de ser administrador(a). Continua participando como avaliador(a).' }
}
