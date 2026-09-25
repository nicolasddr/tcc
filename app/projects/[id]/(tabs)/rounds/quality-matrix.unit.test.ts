import { describe, it, expect } from 'vitest'
import {
  agreementMatrix,
  type MeasuredCell,
  type MeasuredRow,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix'
import {
  qualityMatrix,
  qualityOf,
  qualityPair,
  type QualityPair,
} from '@/app/projects/[id]/(tabs)/rounds/quality'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { scaleRank, type ScaleValue } from '@/app/projects/[id]/(tabs)/evaluate/scale'

type Definition = { id: string; title: string }
type Criterion = { id: string; definitionId: string | null; name: string }
type Row = MeasuredRow<Definition, Criterion, QualityPair>

const informacional: Definition = { id: 'd1', title: 'Informacional' }
const transacional: Definition = { id: 'd2', title: 'Transacional' }

const NONE: ReadonlySet<string> = new Set<string>()

function criterion(id: string, definitionId: string | null): Criterion {
  return { id, definitionId, name: id }
}

function score(
  responseId: string,
  definitionId: string,
  criterionId: string,
  raterId: string,
  value: ScaleValue,
): RoundObservation {
  return {
    unitId: `${responseId}:${definitionId}:${criterionId}`,
    raterId,
    value: scaleRank(value),
    responseId,
    definitionId,
    criterionId,
    projectMemberId: raterId,
  }
}

function ratings(
  definitionId: string,
  criterionId: string,
  byRater: Record<string, readonly ScaleValue[]>,
): RoundObservation[] {
  return Object.entries(byRater).flatMap(([raterId, values]) =>
    values.map((value, index) =>
      score(`r${index + 1}`, definitionId, criterionId, raterId, value),
    ),
  )
}

function cellOf(row: Row, criterionId: string): MeasuredCell<QualityPair> {
  const found = row.cells.find((entry) => entry.column.criterion.id === criterionId)
  if (!found) throw new Error(`coluna ${criterionId} não está na matriz`)
  return found.cell
}

function pairOf(row: Row, criterionId: string): QualityPair {
  const cell = cellOf(row, criterionId)
  if (cell.state !== 'measured') throw new Error(`célula ${criterionId} sem nota`)
  return cell.value
}

describe('qualityMatrix — a distribuição das notas por célula', () => {
  it('tem as mesmas colunas e linhas da matriz de ICR, na mesma ordem', () => {
    const criteria = [
      criterion('c2', 'd2'),
      criterion('g1', null),
      criterion('c1', 'd1'),
      criterion('g2', null),
    ]
    const definitions = [informacional, transacional]
    const observations = ratings('d1', 'g1', { ana: ['high', 'low'], bruno: ['high', 'medium'] })

    const quality = qualityMatrix(definitions, criteria, observations, NONE)
    const agreement = agreementMatrix(definitions, criteria, observations)

    expect(quality.map((row) => row.definition.id)).toEqual(
      agreement.map((row) => row.definition.id),
    )
    expect(quality.map((row) => row.cells.map((entry) => entry.column))).toEqual(
      agreement.map((row) => row.cells.map((entry) => entry.column)),
    )
    expect(quality[0].cells.map((entry) => entry.column.criterion.id)).toEqual([
      'g1',
      'g2',
      'c1',
      'c2',
    ])
  })

  it('o critério geral vale para todas as definições', () => {
    const criteria = [criterion('g1', null)]

    const rows = qualityMatrix(
      [informacional, transacional],
      criteria,
      [
        ...ratings('d1', 'g1', { ana: ['high'] }),
        ...ratings('d2', 'g1', { ana: ['low'] }),
      ],
      NONE,
    )

    expect(rows.map((row) => cellOf(row, 'g1').state)).toEqual(['measured', 'measured'])
  })

  it('critério específico de outra definição é não aplicável, mesmo com nota', () => {
    const criteria = [criterion('c1', 'd1')]

    const [, transacionalRow] = qualityMatrix(
      [informacional, transacional],
      criteria,
      ratings('d2', 'c1', { ana: ['high', 'high'] }),
      NONE,
    )

    expect(cellOf(transacionalRow, 'c1')).toEqual({ state: 'not_applicable' })
  })

  it('célula aplicável que ninguém avaliou fica sem nota, e não vira distribuição vazia', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const [row] = qualityMatrix(
      [informacional],
      criteria,
      ratings('d1', 'g1', { ana: ['high'] }),
      NONE,
    )

    expect(cellOf(row, 'c1')).toEqual({ state: 'unrated' })
    expect(cellOf(row, 'c1')).not.toHaveProperty('value')
  })

  it('cada célula conta só as suas notas, sem vazar para a vizinha', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const [row] = qualityMatrix(
      [informacional],
      criteria,
      [
        ...ratings('d1', 'g1', {
          ana: ['high', 'high', 'high', 'medium'],
          bruno: ['high', 'high', 'medium', 'low'],
        }),
        ...ratings('d1', 'c1', { ana: ['low', 'low'] }),
      ],
      NONE,
    )

    expect(pairOf(row, 'g1').all).toEqual({
      rated: true,
      total: 8,
      levels: [
        { value: 'high', count: 5, share: 0.625 },
        { value: 'medium', count: 2, share: 0.25 },
        { value: 'low', count: 1, share: 0.125 },
      ],
    })
    expect(pairOf(row, 'c1').all).toEqual({
      rated: true,
      total: 2,
      levels: [
        { value: 'high', count: 0, share: 0 },
        { value: 'medium', count: 0, share: 0 },
        { value: 'low', count: 2, share: 1 },
      ],
    })
  })

  it('sem avaliador marcado, cada célula tem um valor só', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const [row] = qualityMatrix(
      [informacional],
      criteria,
      [
        ...ratings('d1', 'g1', { ana: ['high'], bruno: ['low'] }),
        ...ratings('d1', 'c1', { ana: ['medium'] }),
      ],
      NONE,
    )

    expect(pairOf(row, 'g1').withoutOutliers).toBeNull()
    expect(pairOf(row, 'c1').withoutOutliers).toBeNull()
  })

  it('com avaliador marcado, toda célula com nota traz o par, e o com todos não muda', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]
    const g1 = ratings('d1', 'g1', {
      ana: ['high', 'high'],
      bruno: ['high', 'medium'],
      carla: ['low', 'low'],
    })
    const c1 = ratings('d1', 'c1', { ana: ['medium'], bruno: ['high'] })
    const excluded = new Set(['carla'])

    const [row] = qualityMatrix([informacional], criteria, [...g1, ...c1], excluded)

    expect(pairOf(row, 'g1').all).toEqual(qualityOf(g1))
    expect(pairOf(row, 'g1').withoutOutliers).toEqual(
      qualityOf(g1.filter((observation) => observation.raterId !== 'carla')),
    )
    expect(pairOf(row, 'g1').excluded).toBe(1)

    expect(pairOf(row, 'c1')).toEqual(qualityPair(c1, excluded))
    expect(pairOf(row, 'c1').withoutOutliers).not.toBeNull()
    expect(pairOf(row, 'c1').withoutOutliers).toEqual(pairOf(row, 'c1').all)
  })

  it('célula avaliada só pelo marcado tem o com todos e fica sem nota depois da exclusão', () => {
    const criteria = [criterion('g1', null)]

    const [row] = qualityMatrix(
      [informacional],
      criteria,
      ratings('d1', 'g1', { carla: ['low', 'medium'] }),
      new Set(['carla']),
    )

    const pair = pairOf(row, 'g1')
    expect(pair.all).toMatchObject({ rated: true, total: 2 })
    expect(pair.withoutOutliers).toEqual({ rated: false, total: 0 })
  })
})
