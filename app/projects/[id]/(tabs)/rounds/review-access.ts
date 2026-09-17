import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { ownerDb, type DbExecutor, projectMembers } from '@/lib/db'
import { loadPipelineAccess, type PipelineProject } from '../../pipeline/access'
import { listEvaluatedRoundIds, loadReviewRound, type ReviewRound } from './review'

export type ReviewAccess = {
  project: PipelineProject
  isAdmin: boolean
  memberId: string | null
}

export async function requireReviewAccess(
  projectId: string,
  userId: string,
  db: DbExecutor = ownerDb,
): Promise<ReviewAccess> {
  const access = await loadPipelineAccess(projectId, userId, db)
  if (!access.project) notFound()

  const [evaluator] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        eq(projectMembers.role, 'evaluator'),
        eq(projectMembers.status, 'active'),
      ),
    )
    .limit(1)

  if (!access.isAdmin && !evaluator) {
    if (access.onboardingPending) redirect(`/projects/${projectId}/onboarding`)
    notFound()
  }

  return {
    project: access.project,
    isAdmin: access.isAdmin,
    memberId: evaluator?.id ?? null,
  }
}

export async function requireReviewableRound(
  access: ReviewAccess,
  roundId: string,
  db: DbExecutor = ownerDb,
): Promise<ReviewRound> {
  const round = await loadReviewRound(access.project.id, roundId, db)
  if (!round) notFound()
  if (access.isAdmin) return round
  if (!access.memberId) notFound()

  const evaluated = await listEvaluatedRoundIds(access.project.id, access.memberId, db)
  if (!evaluated.includes(round.id)) notFound()

  return round
}
