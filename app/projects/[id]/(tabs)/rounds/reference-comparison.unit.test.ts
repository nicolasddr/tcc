import { describe, it, expect } from 'vitest'
import { referenceComparison } from '@/app/projects/[id]/(tabs)/rounds/reference-comparison'
import type { AgreementPair } from '@/app/projects/[id]/(tabs)/rounds/agreement-pair'
import type { QualityPair } from '@/app/projects/[id]/(tabs)/rounds/quality'
import type { RoundSummary } from '@/app/projects/[id]/(tabs)/rounds/rounds'
import { ROUND_CLOSED, ROUND_OPEN } from '@/app/projects/[id]/(tabs)/rounds/round-status'
import { PHASE_2, PHASE_3, PHASE_4 } from '@/app/projects/[id]/pipeline/preconditions'

function round(
  roundNumber: number,
  phase: number,
  status: string = ROUND_CLOSED,
): RoundSummary {
  return {
    id: `r${roundNumber}`,
    roundNumber,
    status,
    phase,
    createdAt: '2026-01-01T00:00:00.000Z',
    closedAt: status === ROUND_CLOSED ? `2026-01-0${roundNumber}T00:00:00.000Z` : null,
    authorName: 'Ana Pesquisadora',
    codebookVersionId: `cv${roundNumber}`,
    codebookVersionNumber: roundNumber,
    promptVersionNumber: roundNumber + 10,
  }
}

function agreementOf(alpha: number, excluded = 0): AgreementPair {
  const value = { calculable: true as const, alpha, units: 2, raters: 2 }
  return {
    all: value,
    withoutOutliers: excluded === 0 ? null : { ...value, alpha: alpha / 2 },
    excluded,
  }
}

function qualityOf(total: number, excluded = 0): QualityPair {
  return {
    all: { rated: true, total, levels: [] },
    withoutOutliers: excluded === 0 ? null : { rated: true, total: total / 2, levels: [] },
    excluded,
  }
}

function mapsOf(rounds: readonly RoundSummary[]) {
  const agreement = new Map<string, AgreementPair>(
    rounds.map((round) => [round.id, agreementOf(round.roundNumber / 10)]),
  )
  const quality = new Map<string, QualityPair>(
    rounds
      .filter((round) => round.phase >= PHASE_3)
      .map((round) => [round.id, qualityOf(round.roundNumber * 4)]),
  )
  return { agreement, quality }
}

describe('app/projects/[id]/rounds/reference-comparison — referenceComparison', () => {
  it('uma rodada da Fase 2 ou da Fase 3 não é comparada', () => {
    const rounds = [round(1, PHASE_2), round(2, PHASE_3), round(3, PHASE_3)]
    const { agreement, quality } = mapsOf(rounds)

    expect(referenceComparison(rounds, rounds[0], agreement, quality)).toEqual({
      kind: 'not_phase_4',
    })
    expect(referenceComparison(rounds, rounds[2], agreement, quality)).toEqual({
      kind: 'not_phase_4',
    })
  })

  it('uma rodada da Fase 4 sem Fase 3 fechada antes não tem referência', () => {
    const onlyOpen = [round(1, PHASE_3, ROUND_OPEN), round(2, PHASE_4)]
    const none = [round(1, PHASE_2), round(2, PHASE_4)]
    const alone = [round(1, PHASE_4, ROUND_OPEN)]

    for (const rounds of [onlyOpen, none, alone]) {
      const { agreement, quality } = mapsOf(rounds)
      const last = rounds[rounds.length - 1]
      expect(referenceComparison(rounds, last, agreement, quality)).toEqual({
        kind: 'no_reference',
      })
    }
  })

  it('uma rodada da Fase 4 com referência traz os dois lados, com os pares lidos dos mapas', () => {
    const rounds = [round(1, PHASE_2), round(2, PHASE_3), round(3, PHASE_4)]
    const { agreement, quality } = mapsOf(rounds)

    const result = referenceComparison(rounds, rounds[2], agreement, quality)
    expect(result.kind).toBe('compared')
    if (result.kind !== 'compared') return

    expect(result.reference).toEqual({
      id: 'r2',
      roundNumber: 2,
      phase: PHASE_3,
      status: ROUND_CLOSED,
      closedAt: '2026-01-02T00:00:00.000Z',
      codebookVersionNumber: 2,
      promptVersionNumber: 12,
      agreement: agreement.get('r2'),
      quality: quality.get('r2'),
    })
    expect(result.round).toMatchObject({
      id: 'r3',
      roundNumber: 3,
      phase: PHASE_4,
      codebookVersionNumber: 3,
      promptVersionNumber: 13,
    })
    expect(result.reference.agreement).toBe(agreement.get('r2'))
    expect(result.reference.quality).toBe(quality.get('r2'))
    expect(result.round.agreement).toBe(agreement.get('r3'))
    expect(result.round.quality).toBe(quality.get('r3'))
  })

  it('cada rodada da Fase 4 é comparada com a sua referência, também numa passagem anterior', () => {
    const rounds = [
      round(1, PHASE_3),
      round(2, PHASE_4),
      round(3, PHASE_3),
      round(4, PHASE_4, ROUND_OPEN),
    ]
    const { agreement, quality } = mapsOf(rounds)

    const second = referenceComparison(rounds, rounds[1], agreement, quality)
    const fourth = referenceComparison(rounds, rounds[3], agreement, quality)
    expect(second.kind === 'compared' && second.reference.roundNumber).toBe(1)
    expect(fourth.kind === 'compared' && fourth.reference.roundNumber).toBe(3)
  })

  it('cada lado traz o seu par como veio: outlier só na referência', () => {
    const rounds = [round(1, PHASE_3), round(2, PHASE_4)]
    const agreement = new Map([
      ['r1', agreementOf(0.8, 1)],
      ['r2', agreementOf(0.6)],
    ])
    const quality = new Map([
      ['r1', qualityOf(8, 1)],
      ['r2', qualityOf(6)],
    ])

    const result = referenceComparison(rounds, rounds[1], agreement, quality)
    expect(result.kind).toBe('compared')
    if (result.kind !== 'compared') return

    expect(result.reference.agreement.withoutOutliers).not.toBeNull()
    expect(result.reference.quality?.withoutOutliers).not.toBeNull()
    expect(result.round.agreement.withoutOutliers).toBeNull()
    expect(result.round.quality?.withoutOutliers).toBeNull()
  })

  it('a rodada da Fase 4 aberta é comparada normalmente', () => {
    const rounds = [round(1, PHASE_3), round(2, PHASE_4, ROUND_OPEN)]
    const { agreement, quality } = mapsOf(rounds)

    const result = referenceComparison(rounds, rounds[1], agreement, quality)
    expect(result.kind).toBe('compared')
    if (result.kind !== 'compared') return

    expect(result.round.status).toBe(ROUND_OPEN)
    expect(result.round.closedAt).toBeNull()
    expect(result.reference.roundNumber).toBe(1)
  })
})
