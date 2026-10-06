import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  hasReadingGuidance,
  readingGuidance,
  type GuidedPhase,
} from '@/app/projects/[id]/(tabs)/rounds/reading-guidance'
import { AGREEMENT_BANDS } from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import {
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
} from '@/app/projects/[id]/pipeline/preconditions'
import type { Agreement, NotCalculableReason } from '@/lib/agreement'

function measured(alpha: number, units = 12, raters = 3): Agreement {
  return { calculable: true, alpha, units, raters }
}

function notCalculable(reason: NotCalculableReason): Agreement {
  return { calculable: false, reason, units: 0, raters: 1 }
}

const REASONS: NotCalculableReason[] = ['few_evaluators', 'no_shared_units', 'no_variation']

describe('app/projects/[id]/rounds/reading-guidance — por onde ler a rodada', () => {
  it('logo abaixo do corte de aceitável é abaixo da faixa', () => {
    expect(readingGuidance(measured(AGREEMENT_BANDS.acceptable - 0.001), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'below_band',
    })
  })

  it('no corte de aceitável já é dentro da faixa, como em agreementBand', () => {
    expect(readingGuidance(measured(AGREEMENT_BANDS.acceptable), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'within_band',
    })
  })

  it('aceitável e boa são ambas dentro da faixa', () => {
    const between = (AGREEMENT_BANDS.acceptable + AGREEMENT_BANDS.good) / 2
    expect(readingGuidance(measured(between), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'within_band',
    })
    expect(readingGuidance(measured(AGREEMENT_BANDS.good + 0.05), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'within_band',
    })
  })

  it('alpha negativo, de discordância sistemática, é abaixo da faixa', () => {
    expect(readingGuidance(measured(-0.4), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'below_band',
    })
  })

  it('não calculável carrega o motivo', () => {
    for (const reason of REASONS) {
      expect(readingGuidance(notCalculable(reason), PHASE_3)).toEqual({
        phase: PHASE_3,
        kind: 'not_calculable',
        reason,
      })
    }
  })

  it('na Fase 4, os mesmos cortes dão os mesmos casos, com a fase da rodada', () => {
    expect(readingGuidance(measured(AGREEMENT_BANDS.acceptable - 0.001), PHASE_4)).toEqual({
      phase: PHASE_4,
      kind: 'below_band',
    })
    expect(readingGuidance(measured(AGREEMENT_BANDS.acceptable), PHASE_4)).toEqual({
      phase: PHASE_4,
      kind: 'within_band',
    })
    expect(readingGuidance(measured(AGREEMENT_BANDS.good + 0.05), PHASE_4)).toEqual({
      phase: PHASE_4,
      kind: 'within_band',
    })
    for (const reason of REASONS) {
      expect(readingGuidance(notCalculable(reason), PHASE_4)).toEqual({
        phase: PHASE_4,
        kind: 'not_calculable',
        reason,
      })
    }
  })

  it('a fase não muda o caso, só o texto que ele recebe', () => {
    const agreements = [
      measured(AGREEMENT_BANDS.acceptable - 0.001),
      measured(AGREEMENT_BANDS.acceptable),
      measured(AGREEMENT_BANDS.good + 0.05),
      ...REASONS.map(notCalculable),
    ]
    for (const agreement of agreements) {
      expect(readingGuidance(agreement, PHASE_4).kind).toBe(
        readingGuidance(agreement, PHASE_3).kind,
      )
    }
  })

  it('recebe só o Agreement e a fase, e nada de Qualidade', () => {
    expectTypeOf(readingGuidance).parameters.toEqualTypeOf<[Agreement, GuidedPhase]>()
    expect(readingGuidance).toHaveLength(2)
  })

  it('unidades e avaliadores não decidem o caso', () => {
    expect(readingGuidance(measured(0.5, 2, 2), PHASE_3)).toEqual(
      readingGuidance(measured(0.5, 400, 9), PHASE_3),
    )
    expect(readingGuidance(measured(0.9, 2, 2), PHASE_3)).toEqual(
      readingGuidance(measured(0.9, 400, 9), PHASE_3),
    )
  })

  it('as Fases 3 e 4 mostram a orientação', () => {
    expect(hasReadingGuidance(PHASE_1)).toBe(false)
    expect(hasReadingGuidance(PHASE_2)).toBe(false)
    expect(hasReadingGuidance(PHASE_3)).toBe(true)
    expect(hasReadingGuidance(PHASE_4)).toBe(true)
    expect(hasReadingGuidance(5)).toBe(false)
  })
})
