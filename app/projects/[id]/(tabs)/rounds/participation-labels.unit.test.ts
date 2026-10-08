import { describe, it, expect } from 'vitest'
import type { RoundTag } from '../../round-usage'
import { PARTICIPATED_BEFORE, participationBefore } from './participation-labels'

function participationOf(entries: [string, RoundTag[]][]): Map<string, RoundTag[]> {
  return new Map(entries)
}

describe('participationBefore', () => {
  it('a marca curta é a mesma para todos, porque a rodada em foco é sempre a mais nova', () => {
    expect(PARTICIPATED_BEFORE).toBe('já avaliou antes')
  })

  it('só as rodadas de número menor que a do painel entram', () => {
    const participation = participationOf([
      [
        'ana',
        [
          { roundNumber: 1, phase: 2 },
          { roundNumber: 3, phase: 3 },
          { roundNumber: 5, phase: 4 },
        ],
      ],
    ])

    expect(participationBefore(participation, 5)).toEqual({
      ana: { short: PARTICIPATED_BEFORE, full: 'avaliou nas rodadas 1 (Fase 2) e 3 (Fase 3)' },
    })
  })

  it('a própria rodada do painel não conta', () => {
    const participation = participationOf([['bia', [{ roundNumber: 5, phase: 4 }]]])

    expect(participationBefore(participation, 5)).toEqual({})
  })

  it('as rodadas posteriores à do painel não contam', () => {
    const participation = participationOf([
      [
        'ana',
        [
          { roundNumber: 1, phase: 3 },
          { roundNumber: 2, phase: 4 },
          { roundNumber: 4, phase: 4 },
        ],
      ],
    ])

    expect(participationBefore(participation, 2)).toEqual({
      ana: { short: PARTICIPATED_BEFORE, full: 'avaliou na rodada 1 (Fase 3)' },
    })
  })

  it('quem não tem rodada nenhuma fica sem marca', () => {
    const participation = participationOf([
      ['ana', [{ roundNumber: 1, phase: 3 }]],
      ['carla', []],
    ])

    expect(participationBefore(participation, 2)).toEqual({
      ana: { short: PARTICIPATED_BEFORE, full: 'avaliou na rodada 1 (Fase 3)' },
    })
  })

  it('sem participação nenhuma, não há marca', () => {
    expect(participationBefore(new Map(), 3)).toEqual({})
  })
})
