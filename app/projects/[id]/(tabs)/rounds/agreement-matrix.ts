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
import type { CodebookCriterion, RoundCodebook } from '../../pipeline/codebook'
import { PER_RESPONSE_KEY } from '../evaluate/completeness'
import type { RoundObservation } from './agreement'
import { withoutExcluded } from './agreement-pair'

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

export function columnIdentity(column: MatrixColumn<unknown>): string {
  const kind = column.isGeneral ? 'general' : column.isPerResponse ? 'per_response' : 'specific'
  return `${kind}:${column.name.trim()}`
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

export function measuredByColumn<C extends CriterionKey, V>(
  definitions: readonly DefinitionKey[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
  measure: (group: readonly RoundObservation[]) => V,
): { column: MatrixColumn<C>; cell: MeasuredCell<V> }[] {
  const byCell = groupByCell(observations)

  return matrixColumns(definitions, criteria).map((column) => {
    const group = [...column.criteria].flatMap(
      ([definitionId, criterion]) => byCell.get(cellKey(definitionId, criterion.id)) ?? [],
    )
    if (group.length === 0) return { column, cell: { state: 'unrated' } as const }

    return { column, cell: { state: 'measured', value: measure(group) } as const }
  })
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

export function criterionCells<C extends CriterionKey>(
  definitions: readonly DefinitionKey[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
): { column: MatrixColumn<C>; cell: MatrixCell }[] {
  return measuredByColumn(definitions, criteria, observations, measureAgreement).map(
    ({ column, cell }) => ({ column, cell: agreementCell(cell) }),
  )
}

export type CriterionAgreement<C> = {
  column: MatrixColumn<C>
  cell: MatrixCell
  withoutOutliers: MatrixCell | null
}

export function criterionAgreements<C extends CriterionKey>(
  definitions: readonly DefinitionKey[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
  excluded: ReadonlySet<string>,
): CriterionAgreement<C>[] {
  const filtered = excluded.size > 0

  return measuredByColumn(definitions, criteria, observations, (group) => ({
    all: measureAgreement(group),
    withoutOutliers: filtered ? measureAgreement(withoutExcluded(group, excluded)) : null,
  })).map(({ column, cell }) =>
    cell.state === 'measured'
      ? { column, cell: cell.value.all, withoutOutliers: cell.value.withoutOutliers }
      : { column, cell, withoutOutliers: filtered ? cell : null },
  )
}

export type RoundAgreements = CriterionAgreement<CodebookCriterion>[]

const NO_OBSERVATIONS: readonly RoundObservation[] = []

const NO_EXCLUDED: ReadonlySet<string> = new Set<string>()

type RoundKey = { id: string; codebookVersionId: string }

export function roundAgreement(
  round: RoundKey,
  codebooks: ReadonlyMap<string, RoundCodebook>,
  observations: ReadonlyMap<string, readonly RoundObservation[]>,
  outliers: ReadonlyMap<string, ReadonlySet<string>>,
): RoundAgreements {
  const codebook = codebooks.get(round.codebookVersionId)
  return criterionAgreements(
    codebook?.definitions ?? [],
    codebook?.criteria ?? [],
    observations.get(round.id) ?? NO_OBSERVATIONS,
    outliers.get(round.id) ?? NO_EXCLUDED,
  )
}

export function roundAgreements(
  rounds: readonly RoundKey[],
  codebooks: ReadonlyMap<string, RoundCodebook>,
  observations: ReadonlyMap<string, readonly RoundObservation[]>,
  outliers: ReadonlyMap<string, ReadonlySet<string>>,
): Map<string, RoundAgreements> {
  return new Map(
    rounds.map((round) => [
      round.id,
      roundAgreement(round, codebooks, observations, outliers),
    ]),
  )
}

export type WeakestCriterion<C> = {
  column: MatrixColumn<C>
  agreement: Agreement
  profile: AgreementProfile | null
}

export function weakestCriterion<C>(
  rows: readonly { column: MatrixColumn<C>; cell: MatrixCell }[],
): WeakestCriterion<C> | null {
  const measured = rows.flatMap(({ column, cell }) =>
    cell.state === 'calculated'
      ? [{ column, agreement: cell.agreement, profile: cell.profile }]
      : [],
  )

  const missing = measured.find(({ agreement }) => !agreement.calculable)
  if (missing) return missing

  return measured.reduce<WeakestCriterion<C> | null>(
    (lowest, entry) =>
      !lowest ||
      (entry.agreement.calculable &&
        lowest.agreement.calculable &&
        entry.agreement.alpha < lowest.agreement.alpha)
        ? entry
        : lowest,
    null,
  )
}
