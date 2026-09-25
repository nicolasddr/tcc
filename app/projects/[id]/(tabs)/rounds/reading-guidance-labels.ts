import type { NotCalculableReason } from '@/lib/agreement'
import { scaleLabel } from '../evaluate/scale'
import { QUALITY_LABEL } from './quality-labels'
import type { ReadingGuidance } from './reading-guidance'

export const GUIDANCE_HEADING = 'Por onde ler esta rodada'

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

export function guidanceText(guidance: ReadingGuidance): string {
  switch (guidance.kind) {
    case 'below_band':
      return BELOW_BAND_GUIDANCE
    case 'not_calculable':
      return notCalculableGuidance(guidance.reason)
    case 'within_band':
      return WITHIN_BAND_GUIDANCE
  }
}
