import { describe, it, expect } from 'vitest'
import { ordinalAlpha, type Observation } from './agreement'

function fromPairs(pairs: ReadonlyArray<readonly [number, number]>): Observation[] {
  return pairs.flatMap(([a, b], index) => [
    { unitId: `u${index + 1}`, raterId: 'A', value: a },
    { unitId: `u${index + 1}`, raterId: 'B', value: b },
  ])
}

function fromMatrix(rows: Record<string, ReadonlyArray<number | null>>): Observation[] {
  return Object.entries(rows).flatMap(([raterId, values]) =>
    values.flatMap((value, index) =>
      value === null ? [] : [{ unitId: `u${index + 1}`, raterId, value }],
    ),
  )
}

describe('ordinalAlpha', () => {
  it('concordância parcial: dois avaliadores em quatro unidades dão 0,79', () => {
    const result = ordinalAlpha(
      fromPairs([
        [1, 1],
        [2, 2],
        [3, 3],
        [1, 2],
      ]),
    )

    expect(result).toMatchObject({ calculable: true, units: 4, raters: 2 })
    expect(result.calculable && result.alpha).toBeCloseTo(0.79, 10)
  })

  it('concordância perfeita com variação na escala dá 1', () => {
    const values = [1, 2, 3, 1, 2]
    const observations = values.flatMap((value, index) =>
      ['A', 'B', 'C'].map((raterId) => ({ unitId: `u${index + 1}`, raterId, value })),
    )

    const result = ordinalAlpha(observations)

    expect(result).toMatchObject({ calculable: true, units: 5, raters: 3 })
    expect(result.calculable && result.alpha).toBe(1)
  })

  it('distribuição degenerada: 80% de concordância percentual dá alpha negativo', () => {
    const result = ordinalAlpha(
      fromPairs([
        [3, 3],
        [3, 3],
        [3, 3],
        [3, 3],
        [3, 3],
        [3, 3],
        [3, 3],
        [3, 3],
        [3, 2],
        [2, 3],
      ]),
    )

    expect(result).toMatchObject({ calculable: true, units: 10, raters: 2 })
    expect(result.calculable && result.alpha).toBeCloseTo(-1 / 18, 10)
  })

  it('unidade avaliada por uma pessoa só sai do cálculo, e o avaliador fica', () => {
    const result = ordinalAlpha([
      ...fromPairs([
        [1, 1],
        [2, 2],
        [3, 3],
        [1, 2],
      ]),
      { unitId: 'u5', raterId: 'A', value: 3 },
    ])

    expect(result).toMatchObject({ calculable: true, units: 4, raters: 2 })
    expect(result.calculable && result.alpha).toBeCloseTo(0.79, 10)
  })

  it('um avaliador só não é calculável: não há com quem comparar', () => {
    const observations = [1, 2, 3, 1].map((value, index) => ({
      unitId: `u${index + 1}`,
      raterId: 'A',
      value,
    }))

    expect(ordinalAlpha(observations)).toEqual({
      calculable: false,
      reason: 'few_evaluators',
      units: 0,
      raters: 1,
    })
  })

  it('avaliadores que não se cruzam em nenhuma unidade não são calculáveis', () => {
    expect(
      ordinalAlpha([
        { unitId: 'u1', raterId: 'A', value: 1 },
        { unitId: 'u2', raterId: 'A', value: 2 },
        { unitId: 'u3', raterId: 'B', value: 3 },
        { unitId: 'u4', raterId: 'B', value: 1 },
      ]),
    ).toEqual({ calculable: false, reason: 'no_shared_units', units: 0, raters: 2 })
  })

  it('sem variação nas notas não é calculável, e não vira 1', () => {
    const result = ordinalAlpha(
      fromPairs([
        [3, 3],
        [3, 3],
        [3, 3],
      ]),
    )

    expect(result).toEqual({
      calculable: false,
      reason: 'no_variation',
      units: 3,
      raters: 2,
    })
  })

  it('avaliação parcial não exclui o avaliador: ele conta e muda o resultado', () => {
    const doisAvaliadores = fromPairs([
      [1, 1],
      [2, 2],
      [3, 3],
      [1, 2],
      [2, 3],
      [3, 1],
    ])
    const comOTerceiro = [
      ...doisAvaliadores,
      { unitId: 'u1', raterId: 'C', value: 3 },
      { unitId: 'u2', raterId: 'C', value: 3 },
    ]

    const parcial = ordinalAlpha(comOTerceiro)
    const semEle = ordinalAlpha(doisAvaliadores)

    expect(parcial).toMatchObject({ calculable: true, units: 6, raters: 3 })
    expect(semEle).toMatchObject({ calculable: true, units: 6, raters: 2 })
    expect(parcial.calculable && parcial.alpha).not.toBe(semEle.calculable && semEle.alpha)
  })

  it('valor publicado da literatura: Krippendorff (2011), "Computing Krippendorff\'s Alpha-Reliability", matriz de 4 observadores por 12 unidades, ordinal alpha = 0,815', () => {
    const result = ordinalAlpha(
      fromMatrix({
        A: [1, 2, 3, 3, 2, 1, 4, 1, 2, null, null, null],
        B: [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, null, 3],
        C: [null, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, null],
        D: [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, null],
      }),
    )

    expect(result).toMatchObject({ calculable: true, units: 11, raters: 4 })
    expect(result.calculable && result.alpha).toBeCloseTo(0.815, 3)
  })
})
