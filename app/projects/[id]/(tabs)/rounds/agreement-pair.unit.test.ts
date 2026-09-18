import { describe, it, expect } from 'vitest'
import {
  agreementPair,
  evaluatedResponses,
  withoutExcluded,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-pair'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { ordinalAlpha } from '@/lib/agreement'

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

const NONE: ReadonlySet<string> = new Set<string>()

describe('agreementPair — o valor com todos e o valor sem os marcados', () => {
  it('sem exclusão, o par traz só o valor com todos', () => {
    const observations = ratings({ ana: [1, 2, 3], bruno: [1, 2, 3] })

    const pair = agreementPair(observations, NONE)

    expect(pair.withoutOutliers).toBeNull()
    expect(pair.excluded).toBe(0)
    expect(pair.all).toEqual(ordinalAlpha(observations))
  })

  it('com exclusão, os dois existem e o valor com todos continua o mesmo', () => {
    const observations = ratings({
      ana: [1, 2, 3, 1],
      bruno: [1, 2, 3, 1],
      carla: [3, 1, 2, 3],
    })

    const pair = agreementPair(observations, new Set(['carla']))

    expect(pair.all).toEqual(ordinalAlpha(observations))
    expect(pair.excluded).toBe(1)
    expect(pair.withoutOutliers).toEqual(
      ordinalAlpha(ratings({ ana: [1, 2, 3, 1], bruno: [1, 2, 3, 1] })),
    )
    expect(pair.withoutOutliers).not.toEqual(pair.all)
  })

  it('excluir todo mundo menos um deixa o filtrado não calculável, e o com todos intacto', () => {
    const observations = ratings({ ana: [1, 2, 3], bruno: [3, 2, 1] })

    const pair = agreementPair(observations, new Set(['bruno']))

    expect(pair.all).toEqual(ordinalAlpha(observations))
    expect(pair.all.calculable).toBe(true)
    expect(pair.withoutOutliers).toMatchObject({
      calculable: false,
      reason: 'few_evaluators',
      raters: 1,
    })
  })

  it('excluir quem não avaliou não muda o número, e o par continua existindo', () => {
    const observations = ratings({ ana: [1, 2, 3], bruno: [1, 2, 3] })

    const pair = agreementPair(observations, new Set(['ninguem']))

    expect(pair.excluded).toBe(1)
    expect(pair.withoutOutliers).toEqual(pair.all)
    expect(pair.withoutOutliers).not.toBeNull()
  })

  it('withoutExcluded filtra por vínculo, e não toca nas observações que ficam', () => {
    const observations = ratings({ ana: [1, 2], bruno: [3, 3] })

    const kept = withoutExcluded(observations, new Set(['bruno']))

    expect(kept).toHaveLength(2)
    expect(kept.every((observation) => observation.projectMemberId === 'ana')).toBe(true)
    expect(observations).toHaveLength(4)
  })

  it('evaluatedResponses conta resposta distinta, e não nota', () => {
    const observations = ratings({ ana: [1, 2, 3], bruno: [1, 2, 3] })

    expect(evaluatedResponses(observations)).toBe(3)
    expect(evaluatedResponses(withoutExcluded(observations, new Set(['bruno'])))).toBe(3)
    expect(evaluatedResponses([])).toBe(0)
  })
})
