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
  platformPermissionRequests,
  notifications,
} from '@/lib/db'
import { canCreateProjects, findInviteeByEmail, isProjectAdmin } from '@/lib/authz'
import { emitInvitationNotification } from '@/lib/notifications/invitation'
import { normalizeTaskType } from './task-types'

export type CreateProjectState = { error: string } | null

export type RequestPermissionState = { error: string } | { ok: string } | null

export type InviteEvaluatorState = { error: string } | { ok: string } | null

export type UpdateProjectState = { error: string } | { ok: string } | null


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
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

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
    : { ok: `Convite enviado para ${email}. A pessoa verá o convite ao entrar com o Google.` }
}


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

export async function removeMember(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

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
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

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
