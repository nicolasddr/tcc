import { and, asc, eq } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  codebookVersions,
  evaluations,
  profiles,
  projectMembers,
  rounds,
  scores,
} from '@/lib/db'
import { isUuid } from '../../pipeline/versions'
import { isScaleValue } from '../evaluate/scale'
import { ROUND_CLOSED } from './rounds'
import type { CellNote, OutlierNote } from './review-groups'

export type ResponseNote = Omit<CellNote, keyof OutlierNote>

export type ReviewRound = {
  id: string
  roundNumber: number
  status: string
  phase: number
  closedAt: string | null
  codebookVersionId: string
  codebookVersionNumber: number
}

export async function loadReviewRound(
  projectId: string,
  roundId: string,
  db: DbExecutor = ownerDb,
): Promise<ReviewRound | null> {
  if (!isUuid(projectId) || !isUuid(roundId)) return null

  const [round] = await db
    .select({
      id: rounds.id,
      roundNumber: rounds.roundNumber,
      status: rounds.status,
      phase: rounds.phase,
      closedAt: rounds.closedAt,
      codebookVersionId: rounds.codebookVersionId,
      codebookVersionNumber: codebookVersions.versionNumber,
    })
    .from(rounds)
    .innerJoin(codebookVersions, eq(codebookVersions.id, rounds.codebookVersionId))
    .where(and(eq(rounds.id, roundId), eq(rounds.projectId, projectId)))
    .limit(1)

  return round ?? null
}

export async function loadResponseNotes(
  responseId: string,
  db: DbExecutor = ownerDb,
): Promise<ResponseNote[]> {
  if (!isUuid(responseId)) return []

  const rows = await db
    .select({
      projectMemberId: evaluations.projectMemberId,
      evaluatorName: profiles.name,
      definitionId: scores.definitionId,
      criterionId: scores.criterionId,
      value: scores.value,
      justification: scores.justification,
    })
    .from(scores)
    .innerJoin(evaluations, eq(evaluations.id, scores.evaluationId))
    .innerJoin(projectMembers, eq(projectMembers.id, evaluations.projectMemberId))
    .innerJoin(profiles, eq(profiles.id, projectMembers.userId))
    .where(eq(evaluations.responseId, responseId))

  return rows.flatMap((row) =>
    isScaleValue(row.value) ? [{ ...row, value: row.value }] : [],
  )
}

export type ReviewableRound = {
  id: string
  roundNumber: number
  closedAt: string
}

export async function listReviewableRounds(
  projectId: string,
  memberId: string,
  db: DbExecutor = ownerDb,
): Promise<ReviewableRound[]> {
  if (!isUuid(projectId) || !isUuid(memberId)) return []

  const rows = await db
    .selectDistinct({
      id: rounds.id,
      roundNumber: rounds.roundNumber,
      closedAt: rounds.closedAt,
    })
    .from(rounds)
    .innerJoin(evaluations, eq(evaluations.roundId, rounds.id))
    .where(
      and(
        eq(rounds.projectId, projectId),
        eq(rounds.status, ROUND_CLOSED),
        eq(evaluations.projectMemberId, memberId),
      ),
    )
    .orderBy(asc(rounds.roundNumber))

  return rows.flatMap((row) =>
    row.closedAt ? [{ ...row, closedAt: row.closedAt }] : [],
  )
}

export async function listEvaluatedRoundIds(
  projectId: string,
  memberId: string,
  db: DbExecutor = ownerDb,
): Promise<string[]> {
  if (!isUuid(projectId) || !isUuid(memberId)) return []

  const rows = await db
    .selectDistinct({ roundId: evaluations.roundId })
    .from(evaluations)
    .innerJoin(rounds, eq(rounds.id, evaluations.roundId))
    .where(
      and(eq(rounds.projectId, projectId), eq(evaluations.projectMemberId, memberId)),
    )

  return rows.map((row) => row.roundId)
}
