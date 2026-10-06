import { asc, eq } from 'drizzle-orm'
import { ownerDb, type DbExecutor, evaluations, rounds } from '@/lib/db'
import type { RoundTag } from '../../round-usage'

export type EvaluatorParticipation = Map<string, RoundTag[]>

export async function loadEvaluatorParticipation(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<EvaluatorParticipation> {
  const rows = await db
    .selectDistinct({
      memberId: evaluations.projectMemberId,
      roundNumber: rounds.roundNumber,
      phase: rounds.phase,
    })
    .from(evaluations)
    .innerJoin(rounds, eq(rounds.id, evaluations.roundId))
    .where(eq(rounds.projectId, projectId))
    .orderBy(asc(rounds.roundNumber))

  const participation: EvaluatorParticipation = new Map()

  for (const { memberId, roundNumber, phase } of rows) {
    const tags = participation.get(memberId)
    if (tags) tags.push({ roundNumber, phase })
    else participation.set(memberId, [{ roundNumber, phase }])
  }

  return participation
}
