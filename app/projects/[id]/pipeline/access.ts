import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { type DbExecutor, projects, projectMembers } from '@/lib/db'

export type PipelineProject = {
  id: string
  name: string
  phase: number
  taskType: string | null
}

export type PipelineAccess = {
  project: PipelineProject | null
  isAdmin: boolean
  onboardingPending: boolean
}

export async function loadPipelineAccess(
  projectId: string,
  userId: string,
  db: DbExecutor,
): Promise<PipelineAccess> {
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      phase: projects.phase,
      taskType: projects.taskType,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  const memberships = await db
    .select({ role: projectMembers.role, status: projectMembers.status })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    )

  return {
    project: project ?? null,
    isAdmin: memberships.some((m) => m.role === 'administrator' && m.status === 'active'),
    onboardingPending: memberships.some((m) => m.status === 'pending_onboarding'),
  }
}

export function requirePipelineAdmin(
  access: PipelineAccess,
  projectId: string,
): PipelineProject {
  if (!access.project) notFound()
  if (!access.isAdmin && access.onboardingPending) {
    redirect(`/projects/${projectId}/onboarding`)
  }
  if (!access.isAdmin) notFound()
  return access.project
}
