import {
  criteriaOfDefinition,
  isGeneral,
  type DefinitionKey,
} from '../../pipeline/criteria'
import type { ScaleValue } from '../evaluate/scale'
import type { CriterionKey } from './agreement-matrix'
import { classifyDivergence, isDivergent, type CellDivergence } from './divergence'

export type ReviewNote = {
  projectMemberId: string
  evaluatorName: string
  value: ScaleValue
  justification: string | null
}

export type CellNote = ReviewNote & { definitionId: string; criterionId: string }

export type ReviewCell<C> = {
  criterion: C
  isGeneral: boolean
  notes: ReviewNote[]
  divergence: CellDivergence
}

export type ReviewGroup<D, C> = {
  definition: D
  cells: ReviewCell<C>[]
  divergent: number
}

function cellKey(definitionId: string, criterionId: string): string {
  return `${definitionId}:${criterionId}`
}

function groupByCell(notes: readonly CellNote[]): Map<string, ReviewNote[]> {
  const byCell = new Map<string, ReviewNote[]>()

  for (const { definitionId, criterionId, ...note } of notes) {
    const key = cellKey(definitionId, criterionId)
    const group = byCell.get(key)
    if (group) group.push(note)
    else byCell.set(key, [note])
  }

  return byCell
}

function byEvaluator(a: ReviewNote, b: ReviewNote): number {
  return (
    a.evaluatorName.localeCompare(b.evaluatorName, 'pt-BR') ||
    a.projectMemberId.localeCompare(b.projectMemberId)
  )
}

export function reviewGroups<D extends DefinitionKey, C extends CriterionKey>(
  definitions: readonly D[],
  criteria: readonly C[],
  notes: readonly CellNote[],
): ReviewGroup<D, C>[] {
  const byCell = groupByCell(notes)

  return definitions.map((definition) => {
    const cells = criteriaOfDefinition(definition.id, criteria).map((criterion) => {
      const found = byCell.get(cellKey(definition.id, criterion.id)) ?? []
      const cellNotes = [...found].sort(byEvaluator)

      return {
        criterion,
        isGeneral: isGeneral(criterion),
        notes: cellNotes,
        divergence: classifyDivergence(cellNotes.map((note) => note.value)),
      }
    })

    return {
      definition,
      cells,
      divergent: cells.filter((cell) => isDivergent(cell.divergence)).length,
    }
  })
}

export function divergentCells(
  groups: readonly ReviewGroup<unknown, unknown>[],
): number {
  return groups.reduce((total, group) => total + group.divergent, 0)
}

export function ratedCells(groups: readonly ReviewGroup<unknown, unknown>[]): number {
  return groups.reduce(
    (total, group) =>
      total + group.cells.filter((cell) => cell.divergence !== 'unrated').length,
    0,
  )
}
