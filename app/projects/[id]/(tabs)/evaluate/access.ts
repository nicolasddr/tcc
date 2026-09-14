import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { ownerDb, type DbExecutor, projects, projectMembers } from '@/lib/db'

export type EvaluatorProject = {
  id: string
  name: string
  phase: number
  taskType: string | null
}

export type EvaluatorAccess = {
  project: EvaluatorProject
  memberId: string
}

export async function requireEvaluator(
  projectId: string,
  userId: string,
  db: DbExecutor = ownerDb,
): Promise<EvaluatorAccess> {
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

  if (!project) notFound()

  const memberships = await db
    .select({ id: projectMembers.id, status: projectMembers.status })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        eq(projectMembers.role, 'evaluator'),
      ),
    )

  const active = memberships.find((membership) => membership.status === 'active')
  if (active) return { project, memberId: active.id }

  if (memberships.some((membership) => membership.status === 'pending_onboarding')) {
    redirect(`/projects/${projectId}/onboarding`)
  }

  notFound()
}
