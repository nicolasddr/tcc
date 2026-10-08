import { describe, it, expect } from 'vitest'
import {
  itemUsageLabel,
  itemUsageMark,
  participationLabel,
  participationMark,
  roundsLabel,
} from './round-usage'

describe('roundsLabel', () => {
  it('não rotula quando não há rodada nenhuma', () => {
    expect(roundsLabel([])).toBeNull()
    expect(itemUsageLabel([])).toBeNull()
    expect(participationLabel([])).toBeNull()
  })

  it('usa o singular e diz a fase quando há uma rodada só', () => {
    expect(itemUsageLabel([{ roundNumber: 3, phase: 2 }])).toBe('usado na rodada 3 (Fase 2)')
    expect(participationLabel([{ roundNumber: 3, phase: 2 }])).toBe(
      'avaliou na rodada 3 (Fase 2)',
    )
  })

  it('junta as rodadas da mesma fase com "e" antes da última', () => {
    expect(
      itemUsageLabel([
        { roundNumber: 2, phase: 2 },
        { roundNumber: 3, phase: 2 },
      ]),
    ).toBe('usado nas rodadas 2 e 3 (Fase 2)')
    expect(
      itemUsageLabel([
        { roundNumber: 1, phase: 2 },
        { roundNumber: 2, phase: 2 },
        { roundNumber: 3, phase: 2 },
      ]),
    ).toBe('usado nas rodadas 1, 2 e 3 (Fase 2)')
  })

  it('agrupa as rodadas por fase quando as fases são diferentes', () => {
    expect(
      itemUsageLabel([
        { roundNumber: 2, phase: 2 },
        { roundNumber: 3, phase: 2 },
        { roundNumber: 5, phase: 3 },
      ]),
    ).toBe('usado nas rodadas 2 e 3 (Fase 2) e 5 (Fase 3)')
  })

  it('usa o plural mesmo quando cada fase tem uma rodada só', () => {
    expect(
      itemUsageLabel([
        { roundNumber: 1, phase: 2 },
        { roundNumber: 4, phase: 3 },
        { roundNumber: 6, phase: 4 },
      ]),
    ).toBe('usado nas rodadas 1 (Fase 2), 4 (Fase 3) e 6 (Fase 4)')
  })

  it('agrupa por trechos consecutivos quando uma fase volta depois de outra', () => {
    expect(
      itemUsageLabel([
        { roundNumber: 3, phase: 3 },
        { roundNumber: 4, phase: 3 },
        { roundNumber: 5, phase: 4 },
        { roundNumber: 6, phase: 3 },
      ]),
    ).toBe('usado nas rodadas 3 e 4 (Fase 3), 5 (Fase 4) e 6 (Fase 3)')
  })

  it('dá a mesma lista ao item e ao avaliador, mudando só o verbo', () => {
    const rounds = [
      { roundNumber: 1, phase: 2 },
      { roundNumber: 4, phase: 3 },
    ]
    expect(roundsLabel(rounds)).toBe('nas rodadas 1 (Fase 2) e 4 (Fase 3)')
    expect(itemUsageLabel(rounds)).toBe(`usado ${roundsLabel(rounds)}`)
    expect(participationLabel(rounds)).toBe(`avaliou ${roundsLabel(rounds)}`)
  })
})

describe('itemUsageMark e participationMark', () => {
  const threePhases = [
    { roundNumber: 1, phase: 2 },
    { roundNumber: 2, phase: 2 },
    { roundNumber: 4, phase: 3 },
    { roundNumber: 6, phase: 4 },
  ]

  it('sem rodada nenhuma, não há marca', () => {
    expect(itemUsageMark([])).toBeNull()
    expect(participationMark([])).toBeNull()
  })

  it('a marca curta conta as rodadas e a longa guarda a lista por fase', () => {
    expect(itemUsageMark(threePhases)).toEqual({
      short: 'usado em 4 rodadas',
      full: 'usado nas rodadas 1 e 2 (Fase 2), 4 (Fase 3) e 6 (Fase 4)',
    })
    expect(participationMark(threePhases)).toEqual({
      short: 'avaliou em 4 rodadas',
      full: 'avaliou nas rodadas 1 e 2 (Fase 2), 4 (Fase 3) e 6 (Fase 4)',
    })
  })

  it('usa o singular com uma rodada só', () => {
    expect(itemUsageMark([{ roundNumber: 3, phase: 2 }])).toEqual({
      short: 'usado em 1 rodada',
      full: 'usado na rodada 3 (Fase 2)',
    })
    expect(participationMark([{ roundNumber: 3, phase: 2 }])?.short).toBe('avaliou em 1 rodada')
  })
})
