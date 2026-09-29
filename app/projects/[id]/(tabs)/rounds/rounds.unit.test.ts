import { describe, it, expect } from 'vitest'
import { roundsInPhase } from '@/app/projects/[id]/(tabs)/rounds/rounds'
import { PHASE_2, PHASE_3, PHASE_4 } from '@/app/projects/[id]/pipeline/preconditions'

describe('app/projects/[id]/rounds/rounds — roundsInPhase', () => {
  const rounds = [
    { roundNumber: 1, phase: PHASE_2 },
    { roundNumber: 2, phase: PHASE_2 },
    { roundNumber: 3, phase: PHASE_3 },
    { roundNumber: 4, phase: PHASE_3 },
    { roundNumber: 5, phase: PHASE_3 },
  ]

  it('filtra pela fase e preserva a ordem', () => {
    expect(roundsInPhase(rounds, PHASE_3).map((r) => r.roundNumber)).toEqual([3, 4, 5])
    expect(roundsInPhase(rounds, PHASE_2).map((r) => r.roundNumber)).toEqual([1, 2])
  })

  it('devolve lista vazia quando nenhuma rodada é da fase', () => {
    expect(roundsInPhase(rounds, PHASE_4)).toEqual([])
  })
})
