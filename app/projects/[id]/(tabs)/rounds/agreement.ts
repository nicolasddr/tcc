import { and, asc, count, eq } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  evaluations,
  profiles,
  projectMembers,
  rounds,
  scores,
} from '@/lib/db'
import type { Observation } from '@/lib/agreement'
import { isScaleValue, scaleRank } from '../evaluate/scale'
import { isUuid } from '../../pipeline/versions'

export type RoundObservation = Observation & {
  responseId: string
  definitionId: string
  criterionId: string
  projectMemberId: string
}

export type EvaluatorEffort = {
  projectMemberId: string
  name: string
  submitted: number
}

type ScoreRow = {
  responseId: string
  definitionId: string
  criterionId: string
  projectMemberId: string
  value: string
}

function toObservation(row: ScoreRow): RoundObservation[] {
  if (!isScaleValue(row.value)) return []

  return [
    {
      unitId: `${row.responseId}:${row.definitionId}:${row.criterionId}`,
      raterId: row.projectMemberId,
      value: scaleRank(row.value),
      responseId: row.responseId,
      definitionId: row.definitionId,
      criterionId: row.criterionId,
      projectMemberId: row.projectMemberId,
    },
  ]
}

export async function loadRoundObservations(
  roundId: string,
  db: DbExecutor = ownerDb,
): Promise<RoundObservation[]> {
  if (!isUuid(roundId)) return []

  const rows = await db
    .select({
      responseId: evaluations.responseId,
      definitionId: scores.definitionId,
      criterionId: scores.criterionId,
      projectMemberId: evaluations.projectMemberId,
      value: scores.value,
    })
    .from(scores)
    .innerJoin(evaluations, eq(evaluations.id, scores.evaluationId))
    .where(eq(evaluations.roundId, roundId))

  return rows.flatMap(toObservation)
}

export async function loadProjectObservations(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<Map<string, RoundObservation[]>> {
  const byRound = new Map<string, RoundObservation[]>()
  if (!isUuid(projectId)) return byRound

  const rows = await db
    .select({
      roundId: evaluations.roundId,
      responseId: evaluations.responseId,
      definitionId: scores.definitionId,
      criterionId: scores.criterionId,
      projectMemberId: evaluations.projectMemberId,
      value: scores.value,
    })
    .from(scores)
    .innerJoin(evaluations, eq(evaluations.id, scores.evaluationId))
    .innerJoin(rounds, eq(rounds.id, evaluations.roundId))
    .where(eq(rounds.projectId, projectId))

  for (const row of rows) {
    for (const observation of toObservation(row)) {
      const observations = byRound.get(row.roundId)
      if (observations) observations.push(observation)
      else byRound.set(row.roundId, [observation])
    }
  }

  return byRound
}

export async function listEvaluatorEffort(
  roundId: string,
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<EvaluatorEffort[]> {
  if (!isUuid(roundId) || !isUuid(projectId)) return []

  return db
    .select({
      projectMemberId: projectMembers.id,
      name: profiles.name,
      submitted: count(evaluations.id),
    })
    .from(projectMembers)
    .innerJoin(profiles, eq(profiles.id, projectMembers.userId))
    .leftJoin(
      evaluations,
      and(
        eq(evaluations.projectMemberId, projectMembers.id),
        eq(evaluations.roundId, roundId),
      ),
    )
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.role, 'evaluator'),
        eq(projectMembers.status, 'active'),
      ),
    )
    .groupBy(projectMembers.id, profiles.name)
    .orderBy(asc(profiles.name))
}
