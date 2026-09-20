import { and, asc, desc, eq, inArray, or, type SQL } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  consensusNotes,
  profiles,
  projectMembers,
} from '@/lib/db'
import { isUuid } from '../../pipeline/versions'

export type ConsensusVisibility = 'shared' | 'private'

export const CONSENSUS_SHARED = 'shared' satisfies ConsensusVisibility
export const CONSENSUS_PRIVATE = 'private' satisfies ConsensusVisibility

export type ConsensusNote = {
  id: string
  responseId: string
  definitionId: string
  criterionId: string
  projectMemberId: string
  authorName: string
  visibility: ConsensusVisibility
  text: string
  updatedAt: string
}

const NOTE_COLUMNS = {
  id: consensusNotes.id,
  responseId: consensusNotes.responseId,
  definitionId: consensusNotes.definitionId,
  criterionId: consensusNotes.criterionId,
  projectMemberId: consensusNotes.projectMemberId,
  authorName: profiles.name,
  visibility: consensusNotes.visibility,
  text: consensusNotes.text,
  updatedAt: consensusNotes.updatedAt,
}

function visibleTo(memberIds: readonly string[]): SQL {
  const shared = eq(consensusNotes.visibility, CONSENSUS_SHARED)
  const mine = memberIds.filter(isUuid)
  if (mine.length === 0) return shared
  return or(shared, inArray(consensusNotes.projectMemberId, mine))!
}

function selectNotes(db: DbExecutor) {
  return db
    .select(NOTE_COLUMNS)
    .from(consensusNotes)
    .innerJoin(projectMembers, eq(projectMembers.id, consensusNotes.projectMemberId))
    .innerJoin(profiles, eq(profiles.id, projectMembers.userId))
}

function asNotes(rows: (Omit<ConsensusNote, 'visibility'> & { visibility: string })[]) {
  return rows.flatMap((row) =>
    isConsensusVisibility(row.visibility) ? [{ ...row, visibility: row.visibility }] : [],
  )
}

export function isConsensusVisibility(value: string): value is ConsensusVisibility {
  return value === CONSENSUS_SHARED || value === CONSENSUS_PRIVATE
}

export async function loadResponseConsensus(
  responseId: string,
  memberIds: readonly string[],
  db: DbExecutor = ownerDb,
): Promise<ConsensusNote[]> {
  if (!isUuid(responseId)) return []

  const rows = await selectNotes(db)
    .where(and(eq(consensusNotes.responseId, responseId), visibleTo(memberIds)))
    .orderBy(desc(consensusNotes.visibility), asc(profiles.name))

  return asNotes(rows)
}

export async function loadRoundConsensus(
  roundId: string,
  memberIds: readonly string[],
  db: DbExecutor = ownerDb,
): Promise<ConsensusNote[]> {
  if (!isUuid(roundId)) return []

  const rows = await selectNotes(db)
    .where(and(eq(consensusNotes.roundId, roundId), visibleTo(memberIds)))
    .orderBy(desc(consensusNotes.visibility), asc(profiles.name))

  return asNotes(rows)
}
