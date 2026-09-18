import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  ownerDb,
  type DbExecutor,
  profiles,
  projectMembers,
  rounds,
  roundOutliers,
} from '@/lib/db'
import { isUuid } from '../../pipeline/versions'

export type OutlierMark = {
  id: string
  roundId: string
  projectMemberId: string
  evaluatorName: string
  reason: string
  markedAt: string
  markedByName: string
  removedAt: string | null
  removedByName: string | null
}

const marker = alias(profiles, 'marker')
const remover = alias(profiles, 'remover')

const MARK_COLUMNS = {
  id: roundOutliers.id,
  roundId: roundOutliers.roundId,
  projectMemberId: roundOutliers.projectMemberId,
  evaluatorName: profiles.name,
  reason: roundOutliers.reason,
  markedAt: roundOutliers.markedAt,
  markedByName: marker.name,
  removedAt: roundOutliers.removedAt,
  removedByName: remover.name,
}

function selectMarks(db: DbExecutor) {
  return db
    .select(MARK_COLUMNS)
    .from(roundOutliers)
    .innerJoin(projectMembers, eq(projectMembers.id, roundOutliers.projectMemberId))
    .innerJoin(profiles, eq(profiles.id, projectMembers.userId))
    .innerJoin(marker, eq(marker.id, roundOutliers.markedBy))
    .leftJoin(remover, eq(remover.id, roundOutliers.removedBy))
}

/** Marcas ATIVAS de uma rodada, em ordem de nome do avaliador. */
export async function loadRoundOutliers(
  roundId: string,
  db: DbExecutor = ownerDb,
): Promise<OutlierMark[]> {
  if (!isUuid(roundId)) return []

  return selectMarks(db)
    .where(and(eq(roundOutliers.roundId, roundId), isNull(roundOutliers.removedAt)))
    .orderBy(asc(profiles.name))
}

/** Todas as marcas da rodada, ativas e removidas, da mais recente para a mais antiga. */
export async function loadOutlierHistory(
  roundId: string,
  db: DbExecutor = ownerDb,
): Promise<OutlierMark[]> {
  if (!isUuid(roundId)) return []

  return selectMarks(db)
    .where(eq(roundOutliers.roundId, roundId))
    .orderBy(desc(roundOutliers.markedAt), asc(profiles.name))
}

/** roundId → vínculos com marca ATIVA, para a lista de rodadas e a série. */
export async function loadProjectOutliers(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<Map<string, Set<string>>> {
  const byRound = new Map<string, Set<string>>()
  if (!isUuid(projectId)) return byRound

  const rows = await db
    .select({
      roundId: roundOutliers.roundId,
      projectMemberId: roundOutliers.projectMemberId,
    })
    .from(roundOutliers)
    .innerJoin(rounds, eq(rounds.id, roundOutliers.roundId))
    .where(and(eq(rounds.projectId, projectId), isNull(roundOutliers.removedAt)))

  for (const row of rows) {
    const excluded = byRound.get(row.roundId)
    if (excluded) excluded.add(row.projectMemberId)
    else byRound.set(row.roundId, new Set([row.projectMemberId]))
  }

  return byRound
}

export function excludedMemberIds(marks: readonly OutlierMark[]): Set<string> {
  return new Set(marks.map((mark) => mark.projectMemberId))
}
