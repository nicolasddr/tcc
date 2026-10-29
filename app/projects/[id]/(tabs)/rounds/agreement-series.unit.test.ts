import { describe, it, expect } from 'vitest'
import * as series from '@/app/projects/[id]/(tabs)/rounds/agreement-series'
import {
  agreementSeries,
  phaseRuns,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-series'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import type { RoundSummary } from '@/app/projects/[id]/(tabs)/rounds/rounds'
import type { MatrixCell } from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix'
import type { RoundCodebook } from '@/app/projects/[id]/pipeline/codebook'

function round(
  id: string,
  roundNumber: number,
  codebookVersionNumber: number,
  closedAt: string | null = null,
  phase = 2,
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
    promptVersionNumber: 1,
  }
}

type Codebook = RoundCodebook

function codebook(criteria: { id: string; name: string; general?: boolean }[]): Codebook {
  return {
    definitions: [
      { id: 'd1', title: 'Navegacional', type: null, description: null, orderIndex: 0 },
    ],
    criteria: criteria.map(({ id, name, general }, orderIndex) => ({
      id,
      name,
      definitionId: general ? null : 'd1',
      scope: general ? 'general' : 'specific',
      description: null,
      levels: { high: null, medium: null, low: null },
      orderIndex,
    })),
  }
}

function score(
  responseId: string,
  raterId: string,
  value: number,
  criterionId = 'c1',
): RoundObservation {
  return {
    unitId: `${responseId}:d1:${criterionId}`,
    raterId,
    value,
    responseId,
    definitionId: 'd1',
    criterionId,
    projectMemberId: raterId,
  }
}

function ratings(
  byRater: Record<string, readonly number[]>,
  criterionId = 'c1',
): RoundObservation[] {
  return Object.entries(byRater).flatMap(([raterId, values]) =>
    values.map((value, index) => score(`r${index + 1}`, raterId, value, criterionId)),
  )
}

const ONE_CRITERION = new Map<string, Codebook>([
  ['cv1', codebook([{ id: 'c1', name: 'Clareza' }])],
  ['cv2', codebook([{ id: 'c2', name: 'Clareza' }])],
  ['cv3', codebook([{ id: 'c3', name: 'Clareza' }])],
])

function alphaOf(cell: MatrixCell | null) {
  return cell?.state === 'calculated' ? cell.agreement : null
}

describe('agreementSeries — um ponto por rodada, sem agregação', () => {
  it('preserva a ordem cronológica recebida', () => {
    const rounds = [round('a', 1, 1), round('b', 2, 2), round('c', 3, 2)]

    const { rounds: points, criteria } = agreementSeries(rounds, ONE_CRITERION, new Map())

    expect(points.map((point) => point.roundNumber)).toEqual([1, 2, 3])
    expect(points.map((point) => point.roundId)).toEqual(['a', 'b', 'c'])
    expect(criteria[0].points.map((point) => point.roundId)).toEqual(['a', 'b', 'c'])
  })

  it('a rodada sem nenhuma avaliação fica sem nota no critério, e não some da série', () => {
    const { rounds, criteria } = agreementSeries([round('a', 1, 1)], ONE_CRITERION, new Map())

    expect(rounds).toHaveLength(1)
    expect(criteria).toHaveLength(1)
    expect(criteria[0].points[0].cell).toEqual({ state: 'unrated' })
  })

  it('duas rodadas produzem exatamente dois pontos, cada um com a sua versão', () => {
    const rounds = [round('a', 1, 1, '2026-02-01T00:00:00.000Z'), round('b', 2, 2)]
    const observations = new Map<string, RoundObservation[]>([
      ['a', ratings({ ana: [1, 2, 3], bruno: [1, 2, 3] })],
      ['b', ratings({ ana: [1, 2, 3], bruno: [3, 2, 1] }, 'c2')],
    ])

    const { criteria } = agreementSeries(rounds, ONE_CRITERION, observations)
    const points = criteria[0].points

    expect(points).toHaveLength(2)
    expect(points.map((point) => point.codebookVersionNumber)).toEqual([1, 2])
    expect(points[0].closedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(points[1].closedAt).toBeNull()
    expect(alphaOf(points[0].cell)).toMatchObject({ calculable: true, alpha: 1 })
    expect(alphaOf(points[1].cell)).toMatchObject({ calculable: true })
    expect(points[0].cell).not.toEqual(points[1].cell)
  })

  it('sem o mapa de marcas, nenhuma rodada aparece com exclusão', () => {
    const { rounds } = agreementSeries(
      [round('a', 1, 1), round('b', 2, 2)],
      ONE_CRITERION,
      new Map(),
    )

    expect(rounds.map((point) => point.hasOutlier)).toEqual([false, false])
  })

  it('marca só as rodadas com exclusão ativa, e a coluna continua sendo o valor com todos', () => {
    const rounds = [round('a', 1, 1), round('b', 2, 2), round('c', 3, 2)]
    const observations = new Map<string, RoundObservation[]>([
      ['a', ratings({ ana: [1, 2, 3], bruno: [1, 2, 3], carla: [3, 1, 2] })],
      ['b', ratings({ ana: [1, 2, 3], bruno: [1, 2, 3] }, 'c2')],
    ])
    const outliers = new Map<string, ReadonlySet<string>>([
      ['a', new Set(['carla'])],
      ['c', new Set()],
    ])

    const series = agreementSeries(rounds, ONE_CRITERION, observations, outliers)

    expect(series.rounds.map((point) => point.hasOutlier)).toEqual([true, false, false])
    expect(series.criteria[0].points.map((point) => point.hasOutlier)).toEqual([
      true,
      false,
      false,
    ])
    expect(series.criteria[0].points[0].cell).toEqual(
      agreementSeries(rounds, ONE_CRITERION, observations).criteria[0].points[0].cell,
    )
  })

  it('o módulo não exporta nenhuma função de agregação entre rodadas', () => {
    expect(Object.keys(series)).toEqual(['agreementSeries', 'phaseRuns'])

    const { rounds } = agreementSeries(
      [round('a', 1, 1, null, 2), round('b', 2, 2, null, 3)],
      ONE_CRITERION,
      new Map(),
    )
    const grouped = phaseRuns(rounds).flatMap((run) => run.points)

    expect(grouped).toHaveLength(rounds.length)
    grouped.forEach((point, index) => expect(point).toBe(rounds[index]))
  })
})

describe('agreementSeries — uma série por critério', () => {
  it('cada critério tem a sua série, com o seu α, sem um valor que junte os dois', () => {
    const codebooks = new Map<string, Codebook>([
      [
        'cv1',
        codebook([
          { id: 'rel', name: 'Relevance' },
          { id: 'div', name: 'Diversity' },
        ]),
      ],
    ])
    const observations = new Map<string, RoundObservation[]>([
      [
        'a',
        [
          ...ratings({ ana: [1, 2, 3], bruno: [1, 2, 3] }, 'rel'),
          ...ratings({ ana: [1, 2, 3], bruno: [3, 2, 1] }, 'div'),
        ],
      ],
    ])

    const { criteria } = agreementSeries([round('a', 1, 1)], codebooks, observations)

    expect(criteria.map((criterion) => criterion.column.name)).toEqual([
      'Relevance',
      'Diversity',
    ])
    expect(alphaOf(criteria[0].points[0].cell)).toMatchObject({ calculable: true, alpha: 1 })
    expect(alphaOf(criteria[1].points[0].cell)).toMatchObject({ calculable: true })
    expect(alphaOf(criteria[1].points[0].cell)).not.toEqual(alphaOf(criteria[0].points[0].cell))
  })

  it('liga as rodadas pelo nome e pelo tipo, mesmo com ids novos a cada versão', () => {
    const rounds = [round('a', 1, 1), round('b', 2, 2)]

    const { criteria } = agreementSeries(rounds, ONE_CRITERION, new Map())

    expect(criteria).toHaveLength(1)
    expect(criteria[0].key).toBe('specific:Clareza')
    expect(criteria[0].points.map((point) => point.cell)).toEqual([
      { state: 'unrated' },
      { state: 'unrated' },
    ])
  })

  it('o mesmo nome em tipos diferentes vira duas séries', () => {
    const codebooks = new Map<string, Codebook>([
      ['cv1', codebook([{ id: 'c1', name: 'Clareza' }])],
      ['cv2', codebook([{ id: 'c2', name: 'Clareza', general: true }])],
    ])

    const { criteria } = agreementSeries(
      [round('a', 1, 1), round('b', 2, 2)],
      codebooks,
      new Map(),
    )

    expect(criteria.map((criterion) => criterion.key)).toEqual([
      'specific:Clareza',
      'general:Clareza',
    ])
    expect(criteria[0].points.map((point) => point.cell)).toEqual([{ state: 'unrated' }, null])
    expect(criteria[1].points.map((point) => point.cell)).toEqual([null, { state: 'unrated' }])
  })

  it('a rodada cuja versão não tem o critério fica vazia na série dele', () => {
    const codebooks = new Map<string, Codebook>([
      ['cv1', codebook([{ id: 'c1', name: 'Clareza' }])],
      [
        'cv2',
        codebook([
          { id: 'c2', name: 'Clareza' },
          { id: 'c3', name: 'Concisão' },
        ]),
      ],
    ])

    const { criteria } = agreementSeries(
      [round('a', 1, 1), round('b', 2, 2)],
      codebooks,
      new Map(),
    )

    const concision = criteria.find((criterion) => criterion.column.name === 'Concisão')!
    expect(concision.points.map((point) => point.cell)).toEqual([null, { state: 'unrated' }])
    expect(concision.points).toHaveLength(2)
  })

  it('a rodada sem codebook carregado não cria série', () => {
    expect(agreementSeries([round('a', 1, 9)], ONE_CRITERION, new Map()).criteria).toEqual([])
  })
})

describe('agreementSeries — a fase de cada rodada', () => {
  const acrossPhases = () => [
    round('a', 1, 1, '2026-02-01T00:00:00.000Z', 2),
    round('b', 2, 2, '2026-03-01T00:00:00.000Z', 2),
    round('c', 3, 2, '2026-04-01T00:00:00.000Z', 3),
    round('d', 4, 3, null, 3),
  ]

  it('a série carrega a fase de cada rodada, na ordem recebida', () => {
    const { rounds } = agreementSeries(acrossPhases(), ONE_CRITERION, new Map())

    expect(rounds.map((point) => point.phase)).toEqual([2, 2, 3, 3])
    expect(rounds.map((point) => point.roundNumber)).toEqual([1, 2, 3, 4])
  })

  it('as duas fases ficam numa série só, com um ponto por rodada', () => {
    const rounds = acrossPhases()

    const { criteria } = agreementSeries(rounds, ONE_CRITERION, new Map())

    expect(criteria[0].points).toHaveLength(rounds.length)
  })
})

describe('phaseRuns — agrupa por sequência, sem valor próprio', () => {
  function pointsIn(phases: readonly number[]) {
    return agreementSeries(
      phases.map((phase, index) => round(`r${index + 1}`, index + 1, 1, null, phase)),
      ONE_CRITERION,
      new Map(),
    ).rounds
  }

  it('abre um grupo novo cada vez que a fase muda', () => {
    const runs = phaseRuns(pointsIn([2, 2, 3, 3]))

    expect(runs.map((run) => run.phase)).toEqual([2, 3])
    expect(runs.map((run) => run.points.map((point) => point.roundNumber))).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('todas as rodadas da mesma fase formam um grupo só', () => {
    const runs = phaseRuns(pointsIn([2, 2, 2]))

    expect(runs).toHaveLength(1)
    expect(runs[0].phase).toBe(2)
    expect(runs[0].points).toHaveLength(3)
  })

  it('a série vazia não tem grupo', () => {
    expect(phaseRuns([])).toEqual([])
  })

  it('não reordena rodadas: a volta a uma fase abre um grupo novo', () => {
    const runs = phaseRuns(pointsIn([2, 3, 4, 3]))

    expect(runs.map((run) => run.phase)).toEqual([2, 3, 4, 3])
    expect(runs.map((run) => run.points.map((point) => point.roundNumber))).toEqual([
      [1],
      [2],
      [3],
      [4],
    ])
  })

  it('o grupo só tem a fase e os mesmos pontos, sem cópia nem número novo', () => {
    const points = pointsIn([2, 2, 3])
    const runs = phaseRuns(points)

    for (const run of runs) {
      expect(Object.keys(run)).toEqual(['phase', 'points'])
    }
    const grouped = runs.flatMap((run) => run.points)
    expect(grouped).toHaveLength(points.length)
    grouped.forEach((point, index) => expect(point).toBe(points[index]))
  })
})
