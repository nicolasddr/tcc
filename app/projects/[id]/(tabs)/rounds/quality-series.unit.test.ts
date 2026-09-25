import { describe, it, expect } from 'vitest'
import * as series from '@/app/projects/[id]/(tabs)/rounds/quality-series'
import { qualitySeries } from '@/app/projects/[id]/(tabs)/rounds/quality-series'
import { qualityPair } from '@/app/projects/[id]/(tabs)/rounds/quality'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import type { RoundSummary } from '@/app/projects/[id]/(tabs)/rounds/rounds'
import { scaleRank, type ScaleValue } from '@/app/projects/[id]/(tabs)/evaluate/scale'

const NO_OUTLIERS = new Map<string, ReadonlySet<string>>()

function round(
  id: string,
  roundNumber: number,
  phase: number,
  {
    codebookVersionNumber = 1,
    promptVersionNumber = 1,
    closedAt = null,
  }: {
    codebookVersionNumber?: number
    promptVersionNumber?: number
    closedAt?: string | null
  } = {},
): RoundSummary {
  return {
    id,
    roundNumber,
    status: closedAt ? 'closed' : 'open',
    phase,
    createdAt: '2026-01-01T00:00:00.000Z',
    closedAt,
    authorName: 'Ana Pesquisadora',
    codebookVersionId: `cv${codebookVersionNumber}`,
    codebookVersionNumber,
    promptVersionNumber,
  }
}

function score(responseId: string, raterId: string, value: ScaleValue): RoundObservation {
  return {
    unitId: `${responseId}:d1:c1`,
    raterId,
    value: scaleRank(value),
    responseId,
    definitionId: 'd1',
    criterionId: 'c1',
    projectMemberId: raterId,
  }
}

function ratings(byRater: Record<string, readonly ScaleValue[]>): RoundObservation[] {
  return Object.entries(byRater).flatMap(([raterId, values]) =>
    values.map((value, index) => score(`r${index + 1}`, raterId, value)),
  )
}

describe('qualitySeries — um ponto por rodada da Fase 3, sem agregação', () => {
  it('só as rodadas da Fase 3 viram ponto', () => {
    const rounds = [round('a', 1, 2), round('b', 2, 2), round('c', 3, 3), round('d', 4, 3)]

    const points = qualitySeries(rounds, new Map(), NO_OUTLIERS)

    expect(points.map((point) => point.roundNumber)).toEqual([3, 4])
    expect(points.map((point) => point.roundId)).toEqual(['c', 'd'])
  })

  it('preserva a ordem recebida', () => {
    const rounds = [round('c', 3, 3), round('a', 1, 3), round('b', 2, 3)]

    const points = qualitySeries(rounds, new Map(), NO_OUTLIERS)

    expect(points.map((point) => point.roundId)).toEqual(['c', 'a', 'b'])
  })

  it('cada ponto traz as versões de codebook e de prompt da própria rodada', () => {
    const rounds = [
      round('a', 1, 3, {
        codebookVersionNumber: 2,
        promptVersionNumber: 3,
        closedAt: '2026-02-01T00:00:00.000Z',
      }),
      round('b', 2, 3, { codebookVersionNumber: 3, promptVersionNumber: 5 }),
    ]

    const points = qualitySeries(rounds, new Map(), NO_OUTLIERS)

    expect(points.map((point) => point.codebookVersionNumber)).toEqual([2, 3])
    expect(points.map((point) => point.promptVersionNumber)).toEqual([3, 5])
    expect(points.map((point) => point.closedAt)).toEqual(['2026-02-01T00:00:00.000Z', null])
  })

  it('a rodada da Fase 3 sem nota vira ponto sem nota, e não some da série', () => {
    const points = qualitySeries([round('a', 1, 3)], new Map(), NO_OUTLIERS)

    expect(points).toHaveLength(1)
    expect(points[0].pair).toEqual({
      all: { rated: false, total: 0 },
      withoutOutliers: null,
      excluded: 0,
    })
  })

  it('cada ponto é a Qualidade da rodada sozinha, sem nada das vizinhas', () => {
    const rounds = [round('a', 1, 3), round('b', 2, 3)]
    const a = ratings({ ana: ['high', 'high'], bruno: ['high', 'medium'] })
    const b = ratings({ ana: ['low', 'low'], bruno: ['medium', 'low'] })

    const points = qualitySeries(
      rounds,
      new Map([
        ['a', a],
        ['b', b],
      ]),
      NO_OUTLIERS,
    )

    expect(points[0].pair).toEqual(qualityPair(a, new Set()))
    expect(points[1].pair).toEqual(qualityPair(b, new Set()))
    expect(points[0].pair).not.toEqual(points[1].pair)
  })

  it('o módulo não exporta nenhuma função de agregação entre rodadas', () => {
    expect(Object.keys(series)).toEqual(['qualitySeries'])
  })

  it('só a rodada com avaliador marcado traz o par, e o com todos não muda', () => {
    const rounds = [round('a', 1, 3), round('b', 2, 3), round('c', 3, 3)]
    const a = ratings({ ana: ['high', 'high'], bruno: ['high', 'medium'], carla: ['low', 'low'] })
    const b = ratings({ ana: ['high'], bruno: ['medium'] })
    const observations = new Map([
      ['a', a],
      ['b', b],
    ])
    const outliers = new Map<string, ReadonlySet<string>>([
      ['a', new Set(['carla'])],
      ['c', new Set()],
    ])

    const points = qualitySeries(rounds, observations, outliers)

    expect(points[0].pair).toEqual(qualityPair(a, new Set(['carla'])))
    expect(points[0].pair.withoutOutliers).not.toBeNull()
    expect(points[0].pair.all).toEqual(
      qualitySeries(rounds, observations, NO_OUTLIERS)[0].pair.all,
    )
    expect(points[1].pair.withoutOutliers).toBeNull()
    expect(points[2].pair.withoutOutliers).toBeNull()
  })

  it('projeto só com rodadas da Fase 2 dá série vazia', () => {
    const rounds = [round('a', 1, 2), round('b', 2, 2)]
    const observations = new Map([['a', ratings({ ana: ['high'], bruno: ['low'] })]])

    expect(qualitySeries(rounds, observations, NO_OUTLIERS)).toEqual([])
  })
})
