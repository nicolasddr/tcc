import { and, asc, eq } from 'drizzle-orm'
import { ownerDb, type DbExecutor, evaluations, scores } from '@/lib/db'
import { isUuid } from '../../pipeline/versions'

export type EvaluationScore = {
  definitionId: string
  criterionId: string
  value: string
  justification: string | null
}

export type SubmittedEvaluation = {
  id: string
  roundId: string
  responseId: string
  submittedAt: string
  scores: EvaluationScore[]
}

export async function loadEvaluationOf(
  responseId: string,
  memberId: string,
  db: DbExecutor = ownerDb,
): Promise<SubmittedEvaluation | null> {
  if (!isUuid(responseId) || !isUuid(memberId)) return null

  const [evaluation] = await db
    .select({
      id: evaluations.id,
      roundId: evaluations.roundId,
      responseId: evaluations.responseId,
      submittedAt: evaluations.submittedAt,
    })
    .from(evaluations)
    .where(
      and(
        eq(evaluations.responseId, responseId),
        eq(evaluations.projectMemberId, memberId),
      ),
    )
    .limit(1)

  if (!evaluation) return null

  const cells = await db
    .select({
      definitionId: scores.definitionId,
      criterionId: scores.criterionId,
      value: scores.value,
      justification: scores.justification,
    })
    .from(scores)
    .where(eq(scores.evaluationId, evaluation.id))
    .orderBy(asc(scores.definitionId), asc(scores.criterionId))

  return { ...evaluation, scores: cells }
}

export async function loadEvaluatedResponseIds(
  roundId: string,
  memberId: string,
  db: DbExecutor = ownerDb,
): Promise<string[]> {
  if (!isUuid(roundId) || !isUuid(memberId)) return []

  const rows = await db
    .select({ responseId: evaluations.responseId })
    .from(evaluations)
    .where(
      and(eq(evaluations.roundId, roundId), eq(evaluations.projectMemberId, memberId)),
    )

  return rows.map((row) => row.responseId)
}
