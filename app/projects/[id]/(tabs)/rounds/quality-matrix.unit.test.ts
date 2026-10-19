import { describe, it, expect } from 'vitest'
import type { Scope } from '@/app/projects/[id]/pipeline/criteria'
import {
  agreementMatrix,
  matrixColumns,
  type MeasuredCell,
  type MeasuredRow,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix'
import {
  qualityByCriterion,
  qualityMatrix,
  qualityOf,
  qualityPair,
  type QualityPair,
} from '@/app/projects/[id]/(tabs)/rounds/quality'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { scaleRank, type ScaleValue } from '@/app/projects/[id]/(tabs)/evaluate/scale'
import { PER_RESPONSE_KEY } from '@/app/projects/[id]/(tabs)/evaluate/completeness'

type Definition = { id: string; title: string }
type Criterion = { id: string; definitionId: string | null; scope: Scope; name: string }
type Row = MeasuredRow<Definition, Criterion, QualityPair>

const informacional: Definition = { id: 'd1', title: 'Informacional' }
const transacional: Definition = { id: 'd2', title: 'Transacional' }

const NONE: ReadonlySet<string> = new Set<string>()

function criterion(id: string, definitionId: string | null, name = id): Criterion {
  return { id, definitionId, scope: definitionId === null ? 'general' : 'specific', name }
}

function perResponse(id: string, name = id): Criterion {
  return { id, definitionId: null, scope: 'per_response', name }
}

function score(
  responseId: string,
  definitionId: string | null,
  criterionId: string,
  raterId: string,
  value: ScaleValue,
): RoundObservation {
  return {
    unitId: `${responseId}:${definitionId ?? PER_RESPONSE_KEY}:${criterionId}`,
    raterId,
    value: scaleRank(value),
    responseId,
    definitionId,
    criterionId,
    projectMemberId: raterId,
  }
}

function ratings(
  definitionId: string | null,
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
  const found = row.cells.find((entry) => entry.column.name === criterionId)
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

    expect(quality.map((row) => row.definition?.id)).toEqual(
      agreement.map((row) => row.definition?.id),
    )
    expect(quality.map((row) => row.cells.map((entry) => entry.column))).toEqual(
      agreement.map((row) => row.cells.map((entry) => entry.column)),
    )
    expect(quality[0].cells.map((entry) => entry.column.name)).toEqual([
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

  it('critérios específicos de mesmo nome dividem a coluna, cada linha com as suas notas', () => {
    const criteria = [
      criterion('c1', 'd1', 'Aderência à definição'),
      criterion('c2', 'd2', 'Aderência à definição'),
    ]

    const rows = qualityMatrix(
      [informacional, transacional],
      criteria,
      [
        ...ratings('d1', 'c1', { ana: ['high', 'high'] }),
        ...ratings('d2', 'c2', { ana: ['low'] }),
      ],
      NONE,
    )

    expect(rows.map((row) => row.cells.length)).toEqual([1, 1])
    expect(rows.map((row) => pairOf(row, 'Aderência à definição').all.total)).toEqual([2, 1])
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

describe('qualityMatrix — a linha por resposta', () => {
  const queries: Definition[] = [1, 2, 3, 4, 5].map((n) => ({ id: `q${n}`, title: `Query ${n}` }))
  const poc = [criterion('relevance', null, 'Relevance'), perResponse('diversity', 'Diversity')]

  function perResponseRow(rows: readonly Row[]): Row {
    const found = rows.find((row) => row.definition === null)
    if (!found) throw new Error('a linha por resposta não está na matriz')
    return found
  }

  it('a linha por resposta traz a distribuição das notas por resposta, e o par com e sem o marcado', () => {
    const relevance = ratings('q1', 'relevance', { ana: ['low', 'low'], bruno: ['low', 'low'] })
    const diversity = ratings(null, 'diversity', {
      ana: ['high', 'high', 'medium'],
      bruno: ['high', 'low', 'low'],
    })

    const rows = qualityMatrix(queries, poc, [...relevance, ...diversity], new Set(['bruno']))
    const pair = pairOf(perResponseRow(rows), 'Diversity')

    expect(pair.all).toEqual({
      rated: true,
      total: 6,
      levels: [
        { value: 'high', count: 3, share: 0.5 },
        { value: 'medium', count: 1, share: 1 / 6 },
        { value: 'low', count: 2, share: 2 / 6 },
      ],
    })
    expect(pair.withoutOutliers).toEqual({
      rated: true,
      total: 3,
      levels: [
        { value: 'high', count: 2, share: 2 / 3 },
        { value: 'medium', count: 1, share: 1 / 3 },
        { value: 'low', count: 0, share: 0 },
      ],
    })
    expect(pair.excluded).toBe(1)
    expect(pairOf(rows[0], 'Relevance').all.total).toBe(4)
  })
})

describe('qualityByCriterion — uma linha por critério, juntando as definições', () => {
  const navegacional: Definition = { id: 'd3', title: 'Navegacional' }
  const three = [informacional, transacional, navegacional]

  type Entry = ReturnType<typeof qualityByCriterion<Criterion>>[number]

  function entryOf(entries: readonly Entry[], name: string): Entry {
    const found = entries.find((entry) => entry.column.name === name)
    if (!found) throw new Error(`critério ${name} não está na tabela`)
    return found
  }

  function measuredOf(entries: readonly Entry[], name: string): QualityPair {
    const { cell } = entryOf(entries, name)
    if (cell.state !== 'measured') throw new Error(`critério ${name} sem nota`)
    return cell.value
  }

  it('o critério geral em três definições soma as contagens das três células', () => {
    const criteria = [criterion('g1', null)]
    const d1 = ratings('d1', 'g1', { ana: ['high', 'high'], bruno: ['high', 'medium'] })
    const d2 = ratings('d2', 'g1', { ana: ['low'], bruno: ['medium'] })
    const d3 = ratings('d3', 'g1', { ana: ['low', 'low', 'high'], bruno: ['low', 'medium', 'high'] })

    const entries = qualityByCriterion(three, criteria, [...d1, ...d2, ...d3], NONE)
    const pair = measuredOf(entries, 'g1')

    const matrix = qualityMatrix(three, criteria, [...d1, ...d2, ...d3], NONE)
    const counts = matrix.map((row) =>
      pairOf(row, 'g1').all.rated ? pairOf(row, 'g1').all : null,
    )
    const summed = ['high', 'medium', 'low'].map((value) =>
      counts.reduce(
        (total, quality) =>
          total +
          (quality && quality.rated
            ? quality.levels.find((level) => level.value === value)!.count
            : 0),
        0,
      ),
    )

    expect(pair.all).toEqual({
      rated: true,
      total: 12,
      levels: [
        { value: 'high', count: 5, share: 5 / 12 },
        { value: 'medium', count: 3, share: 3 / 12 },
        { value: 'low', count: 4, share: 4 / 12 },
      ],
    })
    expect(pair.all.rated && pair.all.levels.map((level) => level.count)).toEqual(summed)
    expect(pair.withoutOutliers).toBeNull()
    expect(pair.excluded).toBe(0)
  })

  it('com avaliador marcado, o sem os marcados sai das notas juntas sem ele, e o com todos não muda', () => {
    const criteria = [criterion('g1', null)]
    const observations = [
      ...ratings('d1', 'g1', { ana: ['high'], bruno: ['high'], carla: ['low'] }),
      ...ratings('d2', 'g1', { ana: ['medium'], bruno: ['high'], carla: ['low'] }),
    ]
    const excluded = new Set(['carla'])

    const pair = measuredOf(
      qualityByCriterion([informacional, transacional], criteria, observations, excluded),
      'g1',
    )

    expect(pair.all).toEqual(qualityOf(observations))
    expect(pair.withoutOutliers).toEqual({
      rated: true,
      total: 4,
      levels: [
        { value: 'high', count: 3, share: 0.75 },
        { value: 'medium', count: 1, share: 0.25 },
        { value: 'low', count: 0, share: 0 },
      ],
    })
    expect(pair.excluded).toBe(1)
  })

  it('específicos de mesmo nome juntam só as definições que têm o critério', () => {
    const criteria = [
      criterion('c1', 'd1', 'Aderência à definição'),
      criterion('c3', 'd3', 'Aderência à definição'),
    ]
    const own = [
      ...ratings('d1', 'c1', { ana: ['high', 'high'] }),
      ...ratings('d3', 'c3', { ana: ['low'] }),
    ]
    const stray = ratings('d2', 'c1', { ana: ['medium', 'medium', 'medium'] })

    const entries = qualityByCriterion(three, criteria, [...own, ...stray], NONE)

    expect(entries).toHaveLength(1)
    expect(measuredOf(entries, 'Aderência à definição').all).toEqual(qualityOf(own))
  })

  it('o critério por resposta é igual à célula dele na linha “Por resposta”', () => {
    const queries: Definition[] = [1, 2].map((n) => ({ id: `q${n}`, title: `Query ${n}` }))
    const criteria = [criterion('relevance', null, 'Relevance'), perResponse('diversity', 'Diversity')]
    const observations = [
      ...ratings('q1', 'relevance', { ana: ['low'], bruno: ['low'] }),
      ...ratings(null, 'diversity', { ana: ['high', 'medium'], bruno: ['high', 'low'] }),
    ]
    const excluded = new Set(['bruno'])

    const entries = qualityByCriterion(queries, criteria, observations, excluded)
    const matrix = qualityMatrix(queries, criteria, observations, excluded)
    const perResponseRow = matrix.find((row) => row.definition === null)!

    expect(entryOf(entries, 'Diversity').cell).toEqual(cellOf(perResponseRow, 'Diversity'))
    expect(measuredOf(entries, 'Diversity').all.total).toBe(4)
  })

  it('critério que ninguém avaliou fica sem nota, e não vira distribuição vazia', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const entries = qualityByCriterion(
      [informacional],
      criteria,
      ratings('d1', 'g1', { ana: ['high'] }),
      NONE,
    )

    expect(entryOf(entries, 'c1').cell).toEqual({ state: 'unrated' })
  })

  it('a ordem segue as colunas da matriz: gerais, específicos e por resposta', () => {
    const criteria = [
      perResponse('p1'),
      criterion('c2', 'd2'),
      criterion('g1', null),
      criterion('c1', 'd1'),
    ]
    const definitions = [informacional, transacional]

    const entries = qualityByCriterion(definitions, criteria, [], NONE)

    expect(entries.map((entry) => entry.column)).toEqual(matrixColumns(definitions, criteria))
    expect(entries.map((entry) => entry.column.name)).toEqual(['g1', 'c1', 'c2', 'p1'])
  })
})
