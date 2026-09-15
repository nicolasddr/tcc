import { ordinalAlpha, type Agreement } from '@/lib/agreement'
import {
  criteriaOfDefinition,
  generalCriteria,
  isGeneral,
  ownCriteria,
  type CriterionScope,
  type DefinitionKey,
} from '../../pipeline/criteria'
import type { RoundObservation } from './agreement'

export type CriterionKey = DefinitionKey & CriterionScope

export type MatrixCell =
  | { state: 'not_applicable' }
  | { state: 'unrated' }
  | { state: 'calculated'; agreement: Agreement }

export type MatrixColumn<C> = { criterion: C; isGeneral: boolean }

export type MatrixRow<D, C> = {
  definition: D
  cells: { column: MatrixColumn<C>; cell: MatrixCell }[]
}

function cellKey(definitionId: string, criterionId: string): string {
  return `${definitionId}:${criterionId}`
}

function groupByCell(
  observations: readonly RoundObservation[],
): Map<string, RoundObservation[]> {
  const byCell = new Map<string, RoundObservation[]>()
  for (const observation of observations) {
    const key = cellKey(observation.definitionId, observation.criterionId)
    const group = byCell.get(key)
    if (group) group.push(observation)
    else byCell.set(key, [observation])
  }
  return byCell
}

export function matrixColumns<C extends CriterionKey>(
  definitions: readonly DefinitionKey[],
  criteria: readonly C[],
): MatrixColumn<C>[] {
  const ordered = [
    ...generalCriteria(criteria),
    ...definitions.flatMap((definition) => ownCriteria(definition.id, criteria)),
  ]

  return ordered.map((criterion) => ({ criterion, isGeneral: isGeneral(criterion) }))
}

export function agreementMatrix<D extends DefinitionKey, C extends CriterionKey>(
  definitions: readonly D[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
): MatrixRow<D, C>[] {
  const columns = matrixColumns(definitions, criteria)
  const byCell = groupByCell(observations)

  return definitions.map((definition) => {
    const applicable = new Set(
      criteriaOfDefinition(definition.id, criteria).map((criterion) => criterion.id),
    )

    return {
      definition,
      cells: columns.map((column) => {
        if (!applicable.has(column.criterion.id)) {
          return { column, cell: { state: 'not_applicable' } as const }
        }

        const group = byCell.get(cellKey(definition.id, column.criterion.id))
        if (!group) return { column, cell: { state: 'unrated' } as const }

        return { column, cell: { state: 'calculated', agreement: ordinalAlpha(group) } as const }
      }),
    }
  })
}
