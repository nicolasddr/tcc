import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  hasReadingGuidance,
  readingGuidance,
} from '@/app/projects/[id]/(tabs)/rounds/reading-guidance'
import { AGREEMENT_BANDS } from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { PHASE_1, PHASE_2, PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'
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
    expect(readingGuidance(measured(AGREEMENT_BANDS.acceptable - 0.001))).toEqual({
      kind: 'below_band',
    })
  })

  it('no corte de aceitável já é dentro da faixa, como em agreementBand', () => {
    expect(readingGuidance(measured(AGREEMENT_BANDS.acceptable))).toEqual({
      kind: 'within_band',
    })
  })

  it('aceitável e boa são ambas dentro da faixa', () => {
    const between = (AGREEMENT_BANDS.acceptable + AGREEMENT_BANDS.good) / 2
    expect(readingGuidance(measured(between))).toEqual({ kind: 'within_band' })
    expect(readingGuidance(measured(AGREEMENT_BANDS.good + 0.05))).toEqual({
      kind: 'within_band',
    })
  })

  it('alpha negativo, de discordância sistemática, é abaixo da faixa', () => {
    expect(readingGuidance(measured(-0.4))).toEqual({ kind: 'below_band' })
  })

  it('não calculável carrega o motivo', () => {
    for (const reason of REASONS) {
      expect(readingGuidance(notCalculable(reason))).toEqual({
        kind: 'not_calculable',
        reason,
      })
    }
  })

  it('recebe só o Agreement, e nada de Qualidade', () => {
    expectTypeOf(readingGuidance).parameters.toEqualTypeOf<[Agreement]>()
    expect(readingGuidance).toHaveLength(1)
  })

  it('unidades e avaliadores não decidem o caso', () => {
    expect(readingGuidance(measured(0.5, 2, 2))).toEqual(
      readingGuidance(measured(0.5, 400, 9)),
    )
    expect(readingGuidance(measured(0.9, 2, 2))).toEqual(
      readingGuidance(measured(0.9, 400, 9)),
    )
  })

  it('só a Fase 3 mostra a orientação', () => {
    expect(hasReadingGuidance(PHASE_1)).toBe(false)
    expect(hasReadingGuidance(PHASE_2)).toBe(false)
    expect(hasReadingGuidance(PHASE_3)).toBe(true)
    expect(hasReadingGuidance(4)).toBe(false)
  })
})
