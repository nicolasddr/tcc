import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  QUALITY_SECTION_ID,
  guidanceShortcut,
  hasReadingGuidance,
  readingGuidance,
  type GuidanceCriterion,
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

function weakest(agreement: Agreement, concentrated = false): GuidanceCriterion {
  return { name: 'Relevance', agreement, concentrated }
}

describe('app/projects/[id]/rounds/reading-guidance — por onde ler a rodada', () => {
  it('logo abaixo do corte de aceitável é abaixo da faixa', () => {
    expect(readingGuidance(weakest(measured(AGREEMENT_BANDS.acceptable - 0.001)), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'below_band',
      criterion: 'Relevance',
      concentrated: false,
    })
  })

  it('no corte de aceitável já é dentro da faixa, como em agreementBand', () => {
    expect(readingGuidance(weakest(measured(AGREEMENT_BANDS.acceptable)), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'within_band',
    })
  })

  it('aceitável e boa são ambas dentro da faixa', () => {
    const between = (AGREEMENT_BANDS.acceptable + AGREEMENT_BANDS.good) / 2
    expect(readingGuidance(weakest(measured(between)), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'within_band',
    })
    expect(readingGuidance(weakest(measured(AGREEMENT_BANDS.good + 0.05)), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'within_band',
    })
  })

  it('alpha negativo, de discordância sistemática, é abaixo da faixa', () => {
    expect(readingGuidance(weakest(measured(-0.4)), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'below_band',
      criterion: 'Relevance',
      concentrated: false,
    })
  })

  it('não calculável carrega o motivo', () => {
    for (const reason of REASONS) {
      expect(readingGuidance(weakest(notCalculable(reason)), PHASE_3)).toEqual({
        phase: PHASE_3,
        kind: 'not_calculable',
        criterion: 'Relevance',
        reason,
      })
    }
  })

  it('na Fase 4, os mesmos cortes dão os mesmos casos, com a fase da rodada', () => {
    expect(readingGuidance(weakest(measured(AGREEMENT_BANDS.acceptable - 0.001)), PHASE_4)).toEqual({
      phase: PHASE_4,
      kind: 'below_band',
      criterion: 'Relevance',
      concentrated: false,
    })
    expect(readingGuidance(weakest(measured(AGREEMENT_BANDS.acceptable)), PHASE_4)).toEqual({
      phase: PHASE_4,
      kind: 'within_band',
    })
    expect(readingGuidance(weakest(measured(AGREEMENT_BANDS.good + 0.05)), PHASE_4)).toEqual({
      phase: PHASE_4,
      kind: 'within_band',
    })
    for (const reason of REASONS) {
      expect(readingGuidance(weakest(notCalculable(reason)), PHASE_4)).toEqual({
        phase: PHASE_4,
        kind: 'not_calculable',
        criterion: 'Relevance',
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
      expect(readingGuidance(weakest(agreement), PHASE_4).kind).toBe(
        readingGuidance(weakest(agreement), PHASE_3).kind,
      )
    }
  })

  it('recebe só o critério mais fraco e a fase, e nada de Qualidade', () => {
    expectTypeOf(readingGuidance).parameters.toEqualTypeOf<
      [GuidanceCriterion | null, GuidedPhase]
    >()
    expectTypeOf<keyof GuidanceCriterion>().toEqualTypeOf<'name' | 'agreement' | 'concentrated'>()
    expect(readingGuidance).toHaveLength(2)
  })

  it('abaixo da faixa leva o nome do critério e se as notas dele estão concentradas', () => {
    expect(readingGuidance(weakest(measured(-0.031), true), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'below_band',
      criterion: 'Relevance',
      concentrated: true,
    })
    expect(
      readingGuidance({ name: 'Diversity', agreement: measured(0.5), concentrated: false }, PHASE_4),
    ).toEqual({ phase: PHASE_4, kind: 'below_band', criterion: 'Diversity', concentrated: false })
  })

  it('dentro da faixa fala de todos os critérios, e não leva nome nem concentração', () => {
    expect(readingGuidance(weakest(measured(AGREEMENT_BANDS.good), true), PHASE_3)).toEqual({
      phase: PHASE_3,
      kind: 'within_band',
    })
  })

  it('sem critério com nota, não há ICR por falta de avaliadores, e sem nome', () => {
    for (const phase of [PHASE_3, PHASE_4] as const) {
      expect(readingGuidance(null, phase)).toEqual({
        phase,
        kind: 'not_calculable',
        criterion: null,
        reason: 'few_evaluators',
      })
    }
  })

  it('unidades e avaliadores não decidem o caso', () => {
    expect(readingGuidance(weakest(measured(0.5, 2, 2)), PHASE_3)).toEqual(
      readingGuidance(weakest(measured(0.5, 400, 9)), PHASE_3),
    )
    expect(readingGuidance(weakest(measured(0.9, 2, 2)), PHASE_3)).toEqual(
      readingGuidance(weakest(measured(0.9, 400, 9)), PHASE_3),
    )
  })

  it('as Fases 3 e 4 mostram a orientação', () => {
    expect(hasReadingGuidance(PHASE_1)).toBe(false)
    expect(hasReadingGuidance(PHASE_2)).toBe(false)
    expect(hasReadingGuidance(PHASE_3)).toBe(true)
    expect(hasReadingGuidance(PHASE_4)).toBe(true)
    expect(hasReadingGuidance(5)).toBe(false)
  })

  it('na Fase 3 dentro da faixa, o atalho leva à seção de Qualidade', () => {
    expect(guidanceShortcut({ phase: PHASE_3, kind: 'within_band' }, 'p1')).toEqual({
      kind: 'quality',
      href: `#${QUALITY_SECTION_ID}`,
    })
    expect(QUALITY_SECTION_ID).toBe('qualidade')
  })

  it('na Fase 3 abaixo da faixa, o atalho abre o codebook do projeto', () => {
    expect(guidanceShortcut(
        { phase: PHASE_3, kind: 'below_band', criterion: 'Relevance', concentrated: false },
        'p1',
      )).toEqual({
      kind: 'codebook',
      href: '/projects/p1/codebook',
    })
  })

  it('na Fase 3 sem ICR, não há atalho', () => {
    for (const reason of REASONS) {
      expect(guidanceShortcut({ phase: PHASE_3, kind: 'not_calculable', criterion: 'Relevance', reason }, 'p1')).toBeNull()
    }
  })

  it('na Fase 4, não há atalho em nenhum caso', () => {
    expect(guidanceShortcut({ phase: PHASE_4, kind: 'within_band' }, 'p1')).toBeNull()
    expect(guidanceShortcut(
        { phase: PHASE_4, kind: 'below_band', criterion: 'Relevance', concentrated: false },
        'p1',
      )).toBeNull()
    for (const reason of REASONS) {
      expect(guidanceShortcut({ phase: PHASE_4, kind: 'not_calculable', criterion: 'Relevance', reason }, 'p1')).toBeNull()
    }
  })
})
