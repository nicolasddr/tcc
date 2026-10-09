import { ordinalAlpha, type Agreement } from '@/lib/agreement'
import {
  generalCriteria,
  ownCriteria,
  type CriterionScope,
  type DefinitionKey,
} from '../../pipeline/criteria'
import type { RoundObservation } from './agreement'

export type CriterionKey = DefinitionKey & CriterionScope & { name: string }

export type MatrixCell =
  | { state: 'not_applicable' }
  | { state: 'unrated' }
  | { state: 'calculated'; agreement: Agreement }

export type MatrixColumn<C> = {
  key: string
  name: string
  isGeneral: boolean
  criteria: ReadonlyMap<string, C>
}

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
  const general = generalCriteria(criteria).map((criterion) => ({
    key: criterion.id,
    name: criterion.name,
    isGeneral: true,
    criteria: new Map(definitions.map((definition) => [definition.id, criterion])),
  }))

  const specific: { key: string; name: string; criteria: Map<string, C> }[] = []
  for (const definition of definitions) {
    for (const criterion of ownCriteria(definition.id, criteria)) {
      const name = criterion.name.trim()
      const column = specific.find(
        (candidate) => candidate.name === name && !candidate.criteria.has(definition.id),
      )
      if (column) column.criteria.set(definition.id, criterion)
      else {
        specific.push({
          key: criterion.id,
          name,
          criteria: new Map([[definition.id, criterion]]),
        })
      }
    }
  }

  return [...general, ...specific.map((column) => ({ ...column, isGeneral: false }))]
}

export type MeasuredCell<V> =
  | { state: 'not_applicable' }
  | { state: 'unrated' }
  | { state: 'measured'; value: V }

export type MeasuredRow<D, C, V> = {
  definition: D
  cells: { column: MatrixColumn<C>; cell: MeasuredCell<V> }[]
}

export function measuredMatrix<D extends DefinitionKey, C extends CriterionKey, V>(
  definitions: readonly D[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
  measure: (group: readonly RoundObservation[]) => V,
): MeasuredRow<D, C, V>[] {
  const columns = matrixColumns(definitions, criteria)
  const byCell = groupByCell(observations)

  return definitions.map((definition) => ({
    definition,
    cells: columns.map((column) => {
      const criterion = column.criteria.get(definition.id)
      if (!criterion) return { column, cell: { state: 'not_applicable' } as const }

      const group = byCell.get(cellKey(definition.id, criterion.id))
      if (!group) return { column, cell: { state: 'unrated' } as const }

      return { column, cell: { state: 'measured', value: measure(group) } as const }
    }),
  }))
}

function agreementCell(cell: MeasuredCell<Agreement>): MatrixCell {
  if (cell.state !== 'measured') return cell
  return { state: 'calculated', agreement: cell.value }
}

export function agreementMatrix<D extends DefinitionKey, C extends CriterionKey>(
  definitions: readonly D[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
): MatrixRow<D, C>[] {
  return measuredMatrix(definitions, criteria, observations, ordinalAlpha).map((row) => ({
    definition: row.definition,
    cells: row.cells.map(({ column, cell }) => ({ column, cell: agreementCell(cell) })),
  }))
}
