import {
  agreementProfile,
  ordinalAlpha,
  type Agreement,
  type AgreementProfile,
} from '@/lib/agreement'
import {
  generalCriteria,
  ownCriteria,
  perResponseCriteria,
  type CriterionScope,
  type DefinitionKey,
} from '../../pipeline/criteria'
import { PER_RESPONSE_KEY } from '../evaluate/completeness'
import type { RoundObservation } from './agreement'

export type CriterionKey = DefinitionKey & CriterionScope & { name: string }

export type MatrixCell =
  | { state: 'not_applicable' }
  | { state: 'unrated' }
  | { state: 'calculated'; agreement: Agreement; profile: AgreementProfile | null }

export type MatrixColumn<C> = {
  key: string
  name: string
  isGeneral: boolean
  isPerResponse: boolean
  criteria: ReadonlyMap<string | null, C>
}

export type MatrixRow<D, C> = {
  definition: D | null
  cells: { column: MatrixColumn<C>; cell: MatrixCell }[]
}

function cellKey(definitionId: string | null, criterionId: string): string {
  return `${definitionId ?? PER_RESPONSE_KEY}:${criterionId}`
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
    isPerResponse: false,
    criteria: new Map<string | null, C>(
      definitions.map((definition) => [definition.id, criterion]),
    ),
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

  const perResponse = perResponseCriteria(criteria).map((criterion) => ({
    key: criterion.id,
    name: criterion.name,
    isGeneral: false,
    isPerResponse: true,
    criteria: new Map<string | null, C>([[null, criterion]]),
  }))

  return [
    ...general,
    ...specific.map((column) => ({ ...column, isGeneral: false, isPerResponse: false })),
    ...perResponse,
  ]
}

export function allDefinitionsRow<C extends CriterionKey>(
  definitions: readonly DefinitionKey[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
): { column: MatrixColumn<C>; cell: MatrixCell }[] | null {
  if (definitions.length < 2) return null

  const byCell = groupByCell(observations)

  return matrixColumns(definitions, criteria).map((column) => {
    if (column.isPerResponse) return { column, cell: { state: 'not_applicable' } as const }

    const group = [...column.criteria].flatMap(
      ([definitionId, criterion]) => byCell.get(cellKey(definitionId, criterion.id)) ?? [],
    )
    if (group.length === 0) return { column, cell: { state: 'unrated' } as const }

    return { column, cell: measureAgreement(group) }
  })
}

export type MeasuredCell<V> =
  | { state: 'not_applicable' }
  | { state: 'unrated' }
  | { state: 'measured'; value: V }

export type MeasuredRow<D, C, V> = {
  definition: D | null
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
  const rows: (D | null)[] = columns.some((column) => column.isPerResponse)
    ? [...definitions, null]
    : [...definitions]

  return rows.map((definition) => ({
    definition,
    cells: columns.map((column) => {
      const definitionId = definition?.id ?? null
      const criterion = column.criteria.get(definitionId)
      if (!criterion) return { column, cell: { state: 'not_applicable' } as const }

      const group = byCell.get(cellKey(definitionId, criterion.id))
      if (!group) return { column, cell: { state: 'unrated' } as const }

      return { column, cell: { state: 'measured', value: measure(group) } as const }
    }),
  }))
}

function measureAgreement(group: readonly RoundObservation[]): MatrixCell {
  return { state: 'calculated', agreement: ordinalAlpha(group), profile: agreementProfile(group) }
}

function agreementCell(cell: MeasuredCell<MatrixCell>): MatrixCell {
  if (cell.state !== 'measured') return cell
  return cell.value
}

export function agreementMatrix<D extends DefinitionKey, C extends CriterionKey>(
  definitions: readonly D[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
): MatrixRow<D, C>[] {
  return measuredMatrix(definitions, criteria, observations, measureAgreement).map((row) => ({
    definition: row.definition,
    cells: row.cells.map(({ column, cell }) => ({ column, cell: agreementCell(cell) })),
  }))
}
