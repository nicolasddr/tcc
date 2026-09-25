import { describe, it, expect } from 'vitest'
import {
  hasQuality,
  qualityOf,
  qualityPair,
} from '@/app/projects/[id]/(tabs)/rounds/quality'
import {
  agreementPair,
  withoutExcluded,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-pair'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { scaleRank, type ScaleValue } from '@/app/projects/[id]/(tabs)/evaluate/scale'
import { ordinalAlpha } from '@/lib/agreement'

function score(
  responseId: string,
  raterId: string,
  value: ScaleValue,
  cell = 'd1:c1',
): RoundObservation {
  const [definitionId, criterionId] = cell.split(':')
  return {
    unitId: `${responseId}:${cell}`,
    raterId,
    value: scaleRank(value),
    responseId,
    definitionId,
    criterionId,
    projectMemberId: raterId,
  }
}

function ratings(byRater: Record<string, readonly ScaleValue[]>): RoundObservation[] {
  return Object.entries(byRater).flatMap(([raterId, values]) =>
    values.map((value, index) => score(`r${index + 1}`, raterId, value)),
  )
}

const NONE: ReadonlySet<string> = new Set<string>()

describe('qualityOf — a distribuição das notas da rodada', () => {
  it('conta cada ponto da escala e dá a fração sobre o total de notas', () => {
    const observations = ratings({
      ana: ['high', 'high', 'high', 'medium'],
      bruno: ['high', 'high', 'medium', 'low'],
    })

    expect(qualityOf(observations)).toEqual({
      rated: true,
      total: 8,
      levels: [
        { value: 'high', count: 5, share: 0.625 },
        { value: 'medium', count: 2, share: 0.25 },
        { value: 'low', count: 1, share: 0.125 },
      ],
    })
  })

  it('os três pontos aparecem sempre, na ordem da escala, mesmo sem nota', () => {
    const observations = ratings({ ana: ['high', 'high'] })

    expect(qualityOf(observations)).toEqual({
      rated: true,
      total: 2,
      levels: [
        { value: 'high', count: 2, share: 1 },
        { value: 'medium', count: 0, share: 0 },
        { value: 'low', count: 0, share: 0 },
      ],
    })
  })

  it('rodada sem nota não é 0%: não há níveis para desenhar', () => {
    const quality = qualityOf([])

    expect(quality).toEqual({ rated: false, total: 0 })
    expect(quality).not.toHaveProperty('levels')
  })

  it('a unidade é a nota: duas respostas × duas células × dois avaliadores dão oito', () => {
    const observations = ['ana', 'bruno'].flatMap((raterId) =>
      ['r1', 'r2'].flatMap((responseId) =>
        ['d1:c1', 'd1:c2'].map((cell) => score(responseId, raterId, 'medium', cell)),
      ),
    )

    const quality = qualityOf(observations)

    expect(quality.total).toBe(8)
    expect(quality.rated && quality.levels[1]).toEqual({
      value: 'medium',
      count: 8,
      share: 1,
    })
  })
})

describe('qualityPair — o valor com todos e o valor sem os marcados', () => {
  it('sem marca, um valor só', () => {
    const observations = ratings({ ana: ['high', 'low'], bruno: ['medium', 'low'] })

    const pair = qualityPair(observations, NONE)

    expect(pair.withoutOutliers).toBeNull()
    expect(pair.excluded).toBe(0)
    expect(pair.all).toEqual(qualityOf(observations))
  })

  it('com marca, os dois, e o valor com todos continua sendo o sem filtro', () => {
    const observations = ratings({
      ana: ['high', 'high', 'medium'],
      bruno: ['high', 'medium', 'medium'],
      carla: ['low', 'low', 'low'],
    })

    const pair = qualityPair(observations, new Set(['carla']))

    expect(pair.all).toEqual(qualityOf(observations))
    expect(pair.all.total).toBe(9)
    expect(pair.excluded).toBe(1)
    expect(pair.withoutOutliers).toEqual({
      rated: true,
      total: 6,
      levels: [
        { value: 'high', count: 3, share: 0.5 },
        { value: 'medium', count: 3, share: 0.5 },
        { value: 'low', count: 0, share: 0 },
      ],
    })
  })

  it('marcar todo mundo deixa o filtrado sem nota, e o com todos intacto', () => {
    const observations = ratings({ ana: ['high'], bruno: ['low'] })

    const pair = qualityPair(observations, new Set(['ana', 'bruno']))

    expect(pair.all).toEqual(qualityOf(observations))
    expect(pair.all.rated).toBe(true)
    expect(pair.withoutOutliers).toEqual({ rated: false, total: 0 })
  })

  it('usa o mesmo recorte do ICR para o mesmo conjunto de marcas', () => {
    const observations = ratings({
      ana: ['high', 'medium', 'low', 'high'],
      bruno: ['high', 'medium', 'low', 'medium'],
      carla: ['low', 'high', 'medium', 'low'],
    })
    const marked = new Set(['carla'])
    const kept = withoutExcluded(observations, marked)

    const quality = qualityPair(observations, marked)
    const agreement = agreementPair(observations, marked)

    expect(quality.withoutOutliers?.total).toBe(kept.length)
    expect(agreement.withoutOutliers).toEqual(ordinalAlpha(kept))
    expect(quality.withoutOutliers).toEqual(qualityOf(kept))
    expect(quality.excluded).toBe(agreement.excluded)
  })
})

describe('hasQuality — só rodada da Fase 3 tem Qualidade', () => {
  it('é falso nas Fases 1 e 2 e verdadeiro na 3', () => {
    expect(hasQuality(1)).toBe(false)
    expect(hasQuality(2)).toBe(false)
    expect(hasQuality(3)).toBe(true)
  })
})
