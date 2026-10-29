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

export function belowBandGuidance(criterion: string): string {
  return (
    `O ICR de ${criterion} ficou abaixo da faixa de referência: os avaliadores não estão ` +
    'aplicando o codebook da mesma forma. O caminho é refinar o codebook antes de olhar a ' +
    `${QUALITY_LABEL}, porque, enquanto eles não concordam entre si, a distribuição das ` +
    'notas ainda não diz se a LLM segue o codebook.'
  )
}

export const WITHIN_BAND_GUIDANCE =
  'O ICR de todos os critérios está dentro da faixa de referência: os avaliadores ' +
  'concordam, e é ' +
  `hora de olhar a ${QUALITY_LABEL}. Notas concentradas em ${scaleLabel('medium')} e ` +
  `${scaleLabel('low')} indicam que a LLM não está seguindo o codebook, e o refinamento ` +
  'pode ser no prompt, no codebook ou nos dois. Mexer no codebook para ajudar a LLM ' +
  'também muda o que os avaliadores leem.'

export function phase4BelowBandGuidance(criterion: string): string {
  return (
    `O ICR de ${criterion} ficou abaixo da faixa de referência: os avaliadores não estão ` +
    'aplicando o codebook da mesma forma, o que indica que ele não se estendeu a essas ' +
    'pessoas ou a esses itens.'
  )
}

export const PHASE_4_WITHIN_BAND_GUIDANCE =
  'O ICR de todos os critérios está dentro da faixa de referência: os avaliadores ' +
  `concordam entre si, e é hora de olhar a ${QUALITY_LABEL} ao lado da rodada de referência.`

export function concentratedGuidance(criterion: string): string {
  return (
    `As notas de ${criterion} estão concentradas, como diz o aviso na Concordância: o α ` +
    'baixo pode vir da pouca variação nas notas, e não de avaliadores discordando.'
  )
}

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

function noAgreementOf(criterion: string | null): string {
  return criterion === null ? 'Não há ICR nesta rodada' : `Não há ICR para ${criterion}`
}

export function notCalculableGuidance(
  reason: NotCalculableReason,
  criterion: string | null,
): string {
  return (
    `${noAgreementOf(criterion)}: ${notCalculableReasonText(reason)}. Sem esse número não ` +
    'se sabe se os avaliadores aplicam o codebook da mesma forma, e por isso a ' +
    `${QUALITY_LABEL} ainda não é uma leitura confiável.`
  )
}

export function phase4NotCalculableGuidance(
  reason: NotCalculableReason,
  criterion: string | null,
): string {
  return (
    `${noAgreementOf(criterion)}: ${notCalculableReasonText(reason)}. Sem esse número não ` +
    'se sabe se os avaliadores aplicam o codebook da mesma forma, e por isso a ' +
    'comparação com a rodada de referência ainda não é possível.'
  )
}

type PhaseGuidanceTexts = {
  belowBand: (criterion: string) => string
  withinBand: string
  notCalculable: (reason: NotCalculableReason, criterion: string | null) => string
}

const GUIDANCE_TEXTS: Record<GuidedPhase, PhaseGuidanceTexts> = {
  [PHASE_3]: {
    belowBand: belowBandGuidance,
    withinBand: WITHIN_BAND_GUIDANCE,
    notCalculable: notCalculableGuidance,
  },
  [PHASE_4]: {
    belowBand: phase4BelowBandGuidance,
    withinBand: PHASE_4_WITHIN_BAND_GUIDANCE,
    notCalculable: phase4NotCalculableGuidance,
  },
}

export function guidanceText(guidance: ReadingGuidance): string {
  const texts = GUIDANCE_TEXTS[guidance.phase]
  switch (guidance.kind) {
    case 'below_band':
      return guidance.concentrated
        ? `${texts.belowBand(guidance.criterion)} ${concentratedGuidance(guidance.criterion)}`
        : texts.belowBand(guidance.criterion)
    case 'not_calculable':
      return texts.notCalculable(guidance.reason, guidance.criterion)
    case 'within_band':
      return texts.withinBand
  }
}
