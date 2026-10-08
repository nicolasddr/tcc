import type { NotCalculableReason } from '@/lib/agreement'
import { scaleLabel } from '../evaluate/scale'
import { QUALITY_LABEL } from './quality-labels'
import { PHASE_3, PHASE_4 } from '../../pipeline/preconditions'
import type {
  GuidanceShortcutKind,
  GuidedPhase,
  ReadingGuidance,
} from './reading-guidance'

export const GUIDANCE_HEADING = 'Por onde ler esta rodada'

export const QUALITY_SHORTCUT = `Ver a ${QUALITY_LABEL} ↓`

export const CODEBOOK_SHORTCUT = 'Abrir o codebook'

export function shortcutLabel(kind: GuidanceShortcutKind): string {
  switch (kind) {
    case 'quality':
      return QUALITY_SHORTCUT
    case 'codebook':
      return CODEBOOK_SHORTCUT
  }
}

export const BELOW_BAND_GUIDANCE =
  'O ICR desta rodada ficou abaixo da faixa de referência: os avaliadores não estão ' +
  'aplicando o codebook da mesma forma. O caminho é refinar o codebook antes de olhar a ' +
  `${QUALITY_LABEL}, porque, enquanto eles não concordam entre si, a distribuição das ` +
  'notas ainda não diz se a LLM segue o codebook.'

export const WITHIN_BAND_GUIDANCE =
  'O ICR desta rodada está dentro da faixa de referência: os avaliadores concordam, e é ' +
  `hora de olhar a ${QUALITY_LABEL}. Notas concentradas em ${scaleLabel('medium')} e ` +
  `${scaleLabel('low')} indicam que a LLM não está seguindo o codebook, e o refinamento ` +
  'pode ser no prompt, no codebook ou nos dois. Mexer no codebook para ajudar a LLM ' +
  'também muda o que os avaliadores leem.'

export const PHASE_4_BELOW_BAND_GUIDANCE =
  'O ICR desta rodada ficou abaixo da faixa de referência: os avaliadores não estão ' +
  'aplicando o codebook da mesma forma, o que indica que ele não se estendeu a essas ' +
  'pessoas ou a esses itens.'

export const PHASE_4_WITHIN_BAND_GUIDANCE =
  'O ICR desta rodada está dentro da faixa de referência: os avaliadores concordam entre ' +
  `si, e é hora de olhar a ${QUALITY_LABEL} ao lado da rodada de referência.`

export function notCalculableReasonText(reason: NotCalculableReason): string {
  switch (reason) {
    case 'few_evaluators':
      return 'menos de dois avaliadores enviaram avaliação'
    case 'no_shared_units':
      return 'nenhuma resposta-célula foi avaliada por dois avaliadores'
    case 'no_variation':
      return (
        'todas as notas caíram no mesmo ponto da escala, e sem variação o coeficiente ' +
        'fica indefinido'
      )
  }
}

export function notCalculableGuidance(reason: NotCalculableReason): string {
  return (
    `Não há ICR nesta rodada: ${notCalculableReasonText(reason)}. Sem esse número não ` +
    'se sabe se os avaliadores aplicam o codebook da mesma forma, e por isso a ' +
    `${QUALITY_LABEL} ainda não é uma leitura confiável.`
  )
}

export function phase4NotCalculableGuidance(reason: NotCalculableReason): string {
  return (
    `Não há ICR nesta rodada: ${notCalculableReasonText(reason)}. Sem esse número não ` +
    'se sabe se os avaliadores aplicam o codebook da mesma forma, e por isso a ' +
    'comparação com a rodada de referência ainda não é possível.'
  )
}

type PhaseGuidanceTexts = {
  belowBand: string
  withinBand: string
  notCalculable: (reason: NotCalculableReason) => string
}

const GUIDANCE_TEXTS: Record<GuidedPhase, PhaseGuidanceTexts> = {
  [PHASE_3]: {
    belowBand: BELOW_BAND_GUIDANCE,
    withinBand: WITHIN_BAND_GUIDANCE,
    notCalculable: notCalculableGuidance,
  },
  [PHASE_4]: {
    belowBand: PHASE_4_BELOW_BAND_GUIDANCE,
    withinBand: PHASE_4_WITHIN_BAND_GUIDANCE,
    notCalculable: phase4NotCalculableGuidance,
  },
}

export function guidanceText(guidance: ReadingGuidance): string {
  const texts = GUIDANCE_TEXTS[guidance.phase]
  switch (guidance.kind) {
    case 'below_band':
      return texts.belowBand
    case 'not_calculable':
      return texts.notCalculable(guidance.reason)
    case 'within_band':
      return texts.withinBand
  }
}
