import { describe, it, expect } from 'vitest'
import * as labels from '@/app/projects/[id]/(tabs)/rounds/reading-guidance-labels'
import {
  BELOW_BAND_GUIDANCE,
  GUIDANCE_HEADING,
  WITHIN_BAND_GUIDANCE,
  guidanceText,
  notCalculableGuidance,
  notCalculableReasonText,
} from '@/app/projects/[id]/(tabs)/rounds/reading-guidance-labels'
import type { ReadingGuidance } from '@/app/projects/[id]/(tabs)/rounds/reading-guidance'
import { notCalculableMessage } from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { QUALITY_LABEL } from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import { scaleLabel } from '@/app/projects/[id]/(tabs)/evaluate/scale'
import type { NotCalculableReason } from '@/lib/agreement'

const REASONS: NotCalculableReason[] = ['few_evaluators', 'no_shared_units', 'no_variation']

const PHASE_4_WORDS = ['fase 4', 'avançar', 'avance', 'próxima fase']

const JUDGEMENT_WORDS = [
  'melhor',
  'pior',
  'boa',
  'ruim',
  'aprovad',
  'suficiente',
  'basta',
  'pronto',
  'questionável',
]

const BLOCKING_WORDS = ['bloque', 'trava', 'impede', 'não pode', 'desabilit']

const SHARED_REASON_WORDS: Record<NotCalculableReason, string> = {
  few_evaluators: 'dois avaliadores',
  no_shared_units: 'nenhuma resposta-célula',
  no_variation: 'mesmo ponto da escala',
}

function allGuidances(): ReadingGuidance[] {
  return [
    { kind: 'below_band' },
    { kind: 'within_band' },
    ...REASONS.map((reason) => ({ kind: 'not_calculable' as const, reason })),
  ]
}

function allTexts(): string[] {
  const texts: string[] = []
  for (const value of Object.values(labels)) {
    if (typeof value === 'string') texts.push(value)
  }
  for (const reason of REASONS) {
    texts.push(notCalculableReasonText(reason), notCalculableGuidance(reason))
  }
  for (const guidance of allGuidances()) texts.push(guidanceText(guidance))
  return texts
}

describe('app/projects/[id]/rounds/reading-guidance-labels — as palavras da orientação', () => {
  it('cada caso tem um texto diferente', () => {
    const texts = allGuidances().map(guidanceText)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('guidanceText devolve o texto de cada caso', () => {
    expect(guidanceText({ kind: 'below_band' })).toBe(BELOW_BAND_GUIDANCE)
    expect(guidanceText({ kind: 'within_band' })).toBe(WITHIN_BAND_GUIDANCE)
    for (const reason of REASONS) {
      expect(guidanceText({ kind: 'not_calculable', reason })).toBe(
        notCalculableGuidance(reason),
      )
    }
  })

  it('abaixo da faixa manda refinar o codebook antes de olhar a Qualidade', () => {
    expect(BELOW_BAND_GUIDANCE).toContain('abaixo da faixa de referência')
    expect(BELOW_BAND_GUIDANCE).toContain('não estão aplicando o codebook da mesma forma')
    expect(BELOW_BAND_GUIDANCE).toContain(`refinar o codebook antes de olhar a ${QUALITY_LABEL}`)
  })

  it('não calculável diz o motivo, um por caso, e que a Qualidade ainda não é leitura confiável', () => {
    const reasons = REASONS.map(notCalculableReasonText)
    expect(new Set(reasons).size).toBe(REASONS.length)
    for (const reason of REASONS) {
      const text = notCalculableGuidance(reason)
      expect(text).toContain('Não há ICR nesta rodada')
      expect(text).toContain(notCalculableReasonText(reason))
      expect(text).toContain(`a ${QUALITY_LABEL} ainda não é uma leitura confiável`)
    }
  })

  it('o motivo curto fala da mesma coisa que a mensagem longa do painel de Concordância', () => {
    for (const reason of REASONS) {
      const word = SHARED_REASON_WORDS[reason]
      expect(notCalculableReasonText(reason)).toContain(word)
      expect(notCalculableMessage(reason)).toContain(word)
      expect(notCalculableReasonText(reason)).not.toBe(notCalculableMessage(reason))
    }
  })

  it('dentro da faixa manda olhar a Qualidade e diz onde pode estar o refinamento', () => {
    expect(WITHIN_BAND_GUIDANCE).toContain('dentro da faixa de referência')
    expect(WITHIN_BAND_GUIDANCE).toContain('os avaliadores concordam')
    expect(WITHIN_BAND_GUIDANCE).toContain(`é hora de olhar a ${QUALITY_LABEL}`)
    expect(WITHIN_BAND_GUIDANCE).toContain(scaleLabel('medium'))
    expect(WITHIN_BAND_GUIDANCE).toContain(scaleLabel('low'))
    expect(WITHIN_BAND_GUIDANCE).toContain('a LLM não está seguindo o codebook')
    expect(WITHIN_BAND_GUIDANCE).toContain('no prompt, no codebook ou nos dois')
    expect(WITHIN_BAND_GUIDANCE).toContain('muda o que os avaliadores leem')
  })

  it('só dentro da faixa manda olhar a Qualidade agora; os outros dizem que ainda não', () => {
    expect(WITHIN_BAND_GUIDANCE).toContain('é hora de')
    expect(WITHIN_BAND_GUIDANCE).not.toContain('ainda não')
    const others = [BELOW_BAND_GUIDANCE, ...REASONS.map(notCalculableGuidance)]
    for (const text of others) {
      expect(text).not.toContain('é hora de')
      expect(text).toContain('ainda não')
    }
  })

  it('a varredura alcança o cabeçalho e os três casos com os três motivos', () => {
    expect(allTexts()).toEqual(
      expect.arrayContaining([
        GUIDANCE_HEADING,
        BELOW_BAND_GUIDANCE,
        WITHIN_BAND_GUIDANCE,
        ...REASONS.map(notCalculableGuidance),
      ]),
    )
  })

  it('nenhum texto menciona a Fase 4 nem fala em avançar', () => {
    for (const text of allTexts()) {
      for (const word of PHASE_4_WORDS) {
        expect(text.toLowerCase()).not.toContain(word)
      }
    }
  })

  it('nenhum texto julga a rodada nem a Qualidade', () => {
    for (const text of allTexts()) {
      for (const word of JUDGEMENT_WORDS) {
        expect(text.toLowerCase()).not.toContain(word)
      }
    }
  })

  it('nenhum texto proíbe ou trava nada', () => {
    for (const text of allTexts()) {
      for (const word of BLOCKING_WORDS) {
        expect(text.toLowerCase()).not.toContain(word)
      }
    }
  })
})
