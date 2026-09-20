import { CONSENSUS_SHARED, type ConsensusNote } from './consensus'

export type CellConsensus = { minutes: ConsensusNote[]; mine: ConsensusNote | null }

export function consensusCellKey(definitionId: string, criterionId: string): string {
  return `${definitionId}:${criterionId}`
}

function byAuthor(a: ConsensusNote, b: ConsensusNote): number {
  return (
    a.authorName.localeCompare(b.authorName, 'pt-BR') ||
    a.projectMemberId.localeCompare(b.projectMemberId)
  )
}

export function consensusByCell(
  notes: readonly ConsensusNote[],
  authorMemberId: string | null,
): Map<string, CellConsensus> {
  const byCell = new Map<string, CellConsensus>()

  for (const note of notes) {
    const key = consensusCellKey(note.definitionId, note.criterionId)
    const cell = byCell.get(key) ?? { minutes: [], mine: null }
    if (note.visibility === CONSENSUS_SHARED) cell.minutes.push(note)
    if (authorMemberId !== null && note.projectMemberId === authorMemberId) {
      cell.mine = note
    }
    byCell.set(key, cell)
  }

  for (const cell of byCell.values()) cell.minutes.sort(byAuthor)

  return byCell
}
