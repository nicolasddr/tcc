import { describe, it, expect } from 'vitest'
import {
  evaluatedResponses,
  withoutExcluded,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-pair'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'

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

describe('withoutExcluded e evaluatedResponses — o recorte e a contagem', () => {
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
