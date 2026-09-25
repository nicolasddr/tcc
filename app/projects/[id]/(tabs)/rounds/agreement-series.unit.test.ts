import { describe, it, expect } from 'vitest'
import * as series from '@/app/projects/[id]/(tabs)/rounds/agreement-series'
import {
  agreementSeries,
  phaseRuns,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-series'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import type { RoundSummary } from '@/app/projects/[id]/(tabs)/rounds/rounds'

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

function score(
  responseId: string,
  raterId: string,
  value: number,
): RoundObservation {
  return {
    unitId: `${responseId}:d1:c1`,
    raterId,
    value,
    responseId,
    definitionId: 'd1',
    criterionId: 'c1',
    projectMemberId: raterId,
  }
}

function ratings(byRater: Record<string, readonly number[]>): RoundObservation[] {
  return Object.entries(byRater).flatMap(([raterId, values]) =>
    values.map((value, index) => score(`r${index + 1}`, raterId, value)),
  )
}

describe('agreementSeries — um ponto por rodada, sem agregação', () => {
  it('preserva a ordem cronológica recebida', () => {
    const rounds = [round('a', 1, 1), round('b', 2, 2), round('c', 3, 2)]

    const points = agreementSeries(rounds, new Map())

    expect(points.map((point) => point.roundNumber)).toEqual([1, 2, 3])
    expect(points.map((point) => point.roundId)).toEqual(['a', 'b', 'c'])
  })

  it('a rodada sem nenhuma avaliação vira ponto não calculável, e não some da série', () => {
    const points = agreementSeries([round('a', 1, 1)], new Map())

    expect(points).toHaveLength(1)
    expect(points[0].agreement).toEqual({
      calculable: false,
      reason: 'few_evaluators',
      units: 0,
      raters: 0,
    })
  })

  it('duas rodadas produzem exatamente dois pontos, cada um com a sua versão', () => {
    const rounds = [round('a', 1, 1, '2026-02-01T00:00:00.000Z'), round('b', 2, 2)]
    const observations = new Map<string, RoundObservation[]>([
      ['a', ratings({ ana: [1, 2, 3], bruno: [1, 2, 3] })],
      ['b', ratings({ ana: [1, 2, 3], bruno: [3, 2, 1] })],
    ])

    const points = agreementSeries(rounds, observations)

    expect(points).toHaveLength(2)
    expect(points.map((point) => point.codebookVersionNumber)).toEqual([1, 2])
    expect(points[0].closedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(points[1].closedAt).toBeNull()
    expect(points[0].agreement).toMatchObject({ calculable: true, alpha: 1 })
    expect(points[1].agreement).toMatchObject({ calculable: true })
    expect(points[0].agreement).not.toEqual(points[1].agreement)
  })

  it('sem o mapa de marcas, nenhuma rodada aparece com exclusão', () => {
    const points = agreementSeries([round('a', 1, 1), round('b', 2, 2)], new Map())

    expect(points.map((point) => point.hasOutlier)).toEqual([false, false])
  })

  it('marca só as rodadas com exclusão ativa, e a coluna continua sendo o valor com todos', () => {
    const rounds = [round('a', 1, 1), round('b', 2, 2), round('c', 3, 2)]
    const observations = new Map<string, RoundObservation[]>([
      ['a', ratings({ ana: [1, 2, 3], bruno: [1, 2, 3], carla: [3, 1, 2] })],
      ['b', ratings({ ana: [1, 2, 3], bruno: [1, 2, 3] })],
    ])
    const outliers = new Map<string, ReadonlySet<string>>([
      ['a', new Set(['carla'])],
      ['c', new Set()],
    ])

    const points = agreementSeries(rounds, observations, outliers)

    expect(points.map((point) => point.hasOutlier)).toEqual([true, false, false])
    expect(points[0].agreement).toEqual(
      agreementSeries(rounds, observations)[0].agreement,
    )
  })

  it('o módulo não exporta nenhuma função de agregação entre rodadas', () => {
    expect(Object.keys(series)).toEqual(['agreementSeries', 'phaseRuns'])

    const points = agreementSeries(
      [round('a', 1, 1, null, 2), round('b', 2, 2, null, 3)],
      new Map(),
    )
    const grouped = phaseRuns(points).flatMap((run) => run.points)

    expect(grouped).toHaveLength(points.length)
    grouped.forEach((point, index) => expect(point).toBe(points[index]))
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
    const points = agreementSeries(acrossPhases(), new Map())

    expect(points.map((point) => point.phase)).toEqual([2, 2, 3, 3])
    expect(points.map((point) => point.roundNumber)).toEqual([1, 2, 3, 4])
  })

  it('as duas fases ficam numa série só, com um ponto por rodada', () => {
    const rounds = acrossPhases()

    expect(agreementSeries(rounds, new Map())).toHaveLength(rounds.length)
  })
})

describe('phaseRuns — agrupa por sequência, sem valor próprio', () => {
  function pointsIn(phases: readonly number[]) {
    return agreementSeries(
      phases.map((phase, index) => round(`r${index + 1}`, index + 1, 1, null, phase)),
      new Map(),
    )
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
