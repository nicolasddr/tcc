import {
  criteriaOfDefinition,
  isGeneral,
  perResponseCriteria,
  type DefinitionKey,
} from '../../pipeline/criteria'
import { PER_RESPONSE_KEY } from '../evaluate/completeness'
import type { ScaleValue } from '../evaluate/scale'
import type { CriterionKey } from './agreement-matrix'
import { classifyDivergence, isDivergent, type CellDivergence } from './divergence'

export type OutlierNote = {
  isOutlier: boolean
  outlierReason: string | null
}

export type ReviewNote = {
  projectMemberId: string
  evaluatorName: string
  value: ScaleValue
  justification: string | null
} & OutlierNote

export type CellNote = ReviewNote & { definitionId: string | null; criterionId: string }

export type ReviewCell<C> = {
  criterion: C
  isGeneral: boolean
  notes: ReviewNote[]
  divergence: CellDivergence
}

export type ReviewGroup<D, C> = {
  definition: D | null
  cells: ReviewCell<C>[]
  divergent: number
}

function cellKey(definitionId: string | null, criterionId: string): string {
  return `${definitionId ?? PER_RESPONSE_KEY}:${criterionId}`
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

  function group(definition: D | null, groupCriteria: readonly C[]): ReviewGroup<D, C> {
    const cells = groupCriteria.map((criterion) => {
      const found = byCell.get(cellKey(definition?.id ?? null, criterion.id)) ?? []
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
  }

  const definitionGroups = definitions.map((definition) =>
    group(definition, criteriaOfDefinition(definition.id, criteria)),
  )
  const perResponse = perResponseCriteria(criteria)

  return perResponse.length === 0
    ? definitionGroups
    : [...definitionGroups, group(null, perResponse)]
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
