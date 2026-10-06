import { describe, it, expect } from 'vitest'
import * as labels from '@/app/projects/[id]/(tabs)/rounds/reading-guidance-labels'
import {
  BELOW_BAND_GUIDANCE,
  GUIDANCE_HEADING,
  PHASE_4_BELOW_BAND_GUIDANCE,
  PHASE_4_WITHIN_BAND_GUIDANCE,
  WITHIN_BAND_GUIDANCE,
  guidanceText,
  notCalculableGuidance,
  notCalculableReasonText,
  phase4NotCalculableGuidance,
} from '@/app/projects/[id]/(tabs)/rounds/reading-guidance-labels'
import type {
  GuidedPhase,
  ReadingGuidance,
} from '@/app/projects/[id]/(tabs)/rounds/reading-guidance'
import { notCalculableMessage } from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { QUALITY_LABEL } from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import { scaleLabel } from '@/app/projects/[id]/(tabs)/evaluate/scale'
import { PHASE_3, PHASE_4 } from '@/app/projects/[id]/pipeline/preconditions'
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

const RETURN_AND_VERDICT_WORDS = [
  'voltar',
  'volte',
  'retorn',
  'fase 3',
  'refin',
  'aprova',
  'reprova',
  'replic',
  'generaliz',
  'confirmad',
]

const SHARED_REASON_WORDS: Record<NotCalculableReason, string> = {
  few_evaluators: 'dois avaliadores',
  no_shared_units: 'nenhuma resposta-célula',
  no_variation: 'mesmo ponto da escala',
}

function allGuidances(phase: GuidedPhase): ReadingGuidance[] {
  return [
    { phase, kind: 'below_band' },
    { phase, kind: 'within_band' },
    ...REASONS.map((reason) => ({ phase, kind: 'not_calculable' as const, reason })),
  ]
}

function phase3Texts(): string[] {
  const texts = [GUIDANCE_HEADING, BELOW_BAND_GUIDANCE, WITHIN_BAND_GUIDANCE]
  for (const reason of REASONS) {
    texts.push(notCalculableReasonText(reason), notCalculableGuidance(reason))
  }
  for (const guidance of allGuidances(PHASE_3)) texts.push(guidanceText(guidance))
  return texts
}

function phase4Texts(): string[] {
  const texts = [GUIDANCE_HEADING, PHASE_4_BELOW_BAND_GUIDANCE, PHASE_4_WITHIN_BAND_GUIDANCE]
  for (const reason of REASONS) {
    texts.push(notCalculableReasonText(reason), phase4NotCalculableGuidance(reason))
  }
  for (const guidance of allGuidances(PHASE_4)) texts.push(guidanceText(guidance))
  return texts
}

function allTexts(): string[] {
  return [...phase3Texts(), ...phase4Texts()]
}

describe('app/projects/[id]/rounds/reading-guidance-labels — as palavras da orientação', () => {
  it('cada caso tem um texto diferente, em cada fase', () => {
    for (const phase of [PHASE_3, PHASE_4] as const) {
      const texts = allGuidances(phase).map(guidanceText)
      expect(new Set(texts).size).toBe(texts.length)
    }
  })

  it('guidanceText devolve o texto de cada caso', () => {
    expect(guidanceText({ phase: PHASE_3, kind: 'below_band' })).toBe(BELOW_BAND_GUIDANCE)
    expect(guidanceText({ phase: PHASE_3, kind: 'within_band' })).toBe(WITHIN_BAND_GUIDANCE)
    for (const reason of REASONS) {
      expect(guidanceText({ phase: PHASE_3, kind: 'not_calculable', reason })).toBe(
        notCalculableGuidance(reason),
      )
    }
  })

  it('na Fase 4, guidanceText devolve os textos da Fase 4', () => {
    expect(guidanceText({ phase: PHASE_4, kind: 'below_band' })).toBe(
      PHASE_4_BELOW_BAND_GUIDANCE,
    )
    expect(guidanceText({ phase: PHASE_4, kind: 'within_band' })).toBe(
      PHASE_4_WITHIN_BAND_GUIDANCE,
    )
    for (const reason of REASONS) {
      expect(guidanceText({ phase: PHASE_4, kind: 'not_calculable', reason })).toBe(
        phase4NotCalculableGuidance(reason),
      )
    }
  })

  it('cada caso da Fase 4 tem texto próprio, diferente do da Fase 3', () => {
    const phase3 = allGuidances(PHASE_3).map(guidanceText)
    const phase4 = allGuidances(PHASE_4).map(guidanceText)
    phase4.forEach((text, index) => expect(text).not.toBe(phase3[index]))
    expect(new Set([...phase3, ...phase4]).size).toBe(phase3.length + phase4.length)
  })

  it('abaixo da faixa manda refinar o codebook antes de olhar a Qualidade', () => {
    expect(BELOW_BAND_GUIDANCE).toContain('abaixo da faixa de referência')
    expect(BELOW_BAND_GUIDANCE).toContain('não estão aplicando o codebook da mesma forma')
    expect(BELOW_BAND_GUIDANCE).toContain(`refinar o codebook antes de olhar a ${QUALITY_LABEL}`)
  })

  it('na Fase 4, abaixo da faixa diz que o codebook não se estendeu a essas pessoas ou itens', () => {
    expect(PHASE_4_BELOW_BAND_GUIDANCE).toContain('abaixo da faixa de referência')
    expect(PHASE_4_BELOW_BAND_GUIDANCE).toContain(
      'não estão aplicando o codebook da mesma forma',
    )
    expect(PHASE_4_BELOW_BAND_GUIDANCE).toContain(
      'não se estendeu a essas pessoas ou a esses itens',
    )
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

  it('na Fase 4, não calculável diz o mesmo motivo e que a comparação com a referência ainda não é possível', () => {
    for (const reason of REASONS) {
      const text = phase4NotCalculableGuidance(reason)
      expect(text).toContain('Não há ICR nesta rodada')
      expect(text).toContain(notCalculableReasonText(reason))
      expect(text).toContain('a comparação com a rodada de referência ainda não é possível')
      expect(text).not.toContain(QUALITY_LABEL)
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

  it('na Fase 4, dentro da faixa manda olhar a Qualidade ao lado da rodada de referência', () => {
    expect(PHASE_4_WITHIN_BAND_GUIDANCE).toContain('dentro da faixa de referência')
    expect(PHASE_4_WITHIN_BAND_GUIDANCE).toContain('concordam entre si')
    expect(PHASE_4_WITHIN_BAND_GUIDANCE).toContain(
      `é hora de olhar a ${QUALITY_LABEL} ao lado da rodada de referência`,
    )
    expect(PHASE_4_WITHIN_BAND_GUIDANCE).not.toContain(scaleLabel('medium'))
    expect(PHASE_4_WITHIN_BAND_GUIDANCE).not.toContain('LLM')
    expect(PHASE_4_WITHIN_BAND_GUIDANCE).not.toContain('prompt')
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

  it('na Fase 4, só dentro da faixa diz que é hora de olhar algo', () => {
    expect(PHASE_4_WITHIN_BAND_GUIDANCE).toContain('é hora de')
    const others = [PHASE_4_BELOW_BAND_GUIDANCE, ...REASONS.map(phase4NotCalculableGuidance)]
    for (const text of others) {
      expect(text).not.toContain('é hora de')
    }
  })

  it('a varredura alcança o cabeçalho e os três casos com os três motivos, nas duas fases', () => {
    expect(allTexts()).toEqual(
      expect.arrayContaining([
        GUIDANCE_HEADING,
        BELOW_BAND_GUIDANCE,
        WITHIN_BAND_GUIDANCE,
        PHASE_4_BELOW_BAND_GUIDANCE,
        PHASE_4_WITHIN_BAND_GUIDANCE,
        ...REASONS.map(notCalculableGuidance),
        ...REASONS.map(phase4NotCalculableGuidance),
      ]),
    )
  })

  it('as duas listas alcançam todo texto exportado', () => {
    const texts = allTexts()
    for (const value of Object.values(labels)) {
      if (typeof value === 'string') expect(texts).toContain(value)
    }
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

  it('nenhum texto da Fase 4 fala em voltar, refinar ou veredito', () => {
    for (const text of phase4Texts()) {
      for (const word of RETURN_AND_VERDICT_WORDS) {
        expect(text.toLowerCase()).not.toContain(word)
      }
    }
  })
})
