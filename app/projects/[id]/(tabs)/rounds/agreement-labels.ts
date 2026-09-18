import { plural } from '@/lib/plural'
import type { Agreement, NotCalculableReason } from '@/lib/agreement'

export type AgreementBand = 'questionable' | 'acceptable' | 'good'

export type BandTone = 'danger' | 'warning' | 'success'

export const AGREEMENT_LABEL = 'Concordância (ICR)'

export const AGREEMENT_ALL_LABEL = 'com todos'

export const AGREEMENT_WITHOUT_OUTLIERS_LABEL = 'sem os marcados como outlier'

export const NOT_CALCULABLE_LABEL = 'não calculável'

export const AGREEMENT_SOURCE = 'Krippendorff (2004)'

export const AGREEMENT_BANDS = { acceptable: 0.667, good: 0.8 } as const

export const SMALL_SAMPLE_RATERS = 3

export const SMALL_SAMPLE_RESPONSES = 10

export const CELL_NOT_APPLICABLE = '—'

export const CELL_NOT_APPLICABLE_TITLE = 'critério específico de outra definição'

export const CELL_UNRATED_LABEL = 'sem nota'

export const MATRIX_LEGEND =
  `Na matriz, “${CELL_UNRATED_LABEL}” é célula que existe no codebook e que ninguém ` +
  `avaliou ainda; “${cellNotCalculableLabel('few_evaluators')}”, ` +
  `“${cellNotCalculableLabel('no_shared_units')}” e ` +
  `“${cellNotCalculableLabel('no_variation')}” são células com nota e sem coeficiente, ` +
  'respectivamente por um avaliador só, por nenhuma resposta avaliada por dois deles e ' +
  `por todas as notas no mesmo ponto da escala; e “${CELL_NOT_APPLICABLE}” é ` +
  `${CELL_NOT_APPLICABLE_TITLE}, que não se aplica a esta. Nenhum desses casos vale zero.`

export const OUTLIER_PAIR_HINT =
  `Os dois valores saem do mesmo dado desta rodada. O primeiro, ${AGREEMENT_ALL_LABEL}, ` +
  'é o resultado da rodada e continua sendo ele. O segundo, ' +
  `${AGREEMENT_WITHOUT_OUTLIERS_LABEL}, refaz a conta retirando as notas de quem foi ` +
  'marcado, e existe para mostrar o quanto a exclusão move o número. A exclusão é ' +
  'declarada e justificada uma a uma, nunca sugerida pela ferramenta, e nenhuma nota é ' +
  'apagada por causa dela.'

export const MATRIX_SCOPE_NOTE =
  `A matriz por célula é calculada ${AGREEMENT_ALL_LABEL}, inclusive com as notas de ` +
  'quem está marcado como outlier nesta rodada. O par com e sem os marcados aparece só ' +
  'no coeficiente da rodada, acima.'

export const BAND_REFERENCE =
  `Faixa de referência de ${AGREEMENT_SOURCE}: abaixo de ` +
  `${formatCut(AGREEMENT_BANDS.acceptable)} é questionável, de ` +
  `${formatCut(AGREEMENT_BANDS.acceptable)} a ${formatCut(AGREEMENT_BANDS.good)} é ` +
  `aceitável, e ${formatCut(AGREEMENT_BANDS.good)} ou mais é boa. É referência de ` +
  'leitura, e não trava nada no projeto.'

function formatCut(cut: number): string {
  return String(cut).replace('.', ',')
}

export function agreementBand(alpha: number): AgreementBand {
  if (alpha >= AGREEMENT_BANDS.good) return 'good'
  if (alpha >= AGREEMENT_BANDS.acceptable) return 'acceptable'
  return 'questionable'
}

export function bandLabel(band: AgreementBand): string {
  switch (band) {
    case 'good':
      return 'boa'
    case 'acceptable':
      return 'aceitável'
    case 'questionable':
      return 'questionável'
  }
}

export function bandTone(band: AgreementBand): BandTone {
  switch (band) {
    case 'good':
      return 'success'
    case 'acceptable':
      return 'warning'
    case 'questionable':
      return 'danger'
  }
}

export function formatAlpha(alpha: number): string {
  return alpha.toFixed(3).replace('.', ',')
}

export function sampleSize({
  units,
  raters,
}: Pick<Agreement, 'units' | 'raters'>): string {
  return `${plural(units, 'unidade', 'unidades')} · ${plural(
    raters,
    'avaliador',
    'avaliadores',
  )}`
}

export function smallSampleWarning({
  raters,
  responses,
}: {
  raters: number
  responses: number
}): string | null {
  if (raters >= SMALL_SAMPLE_RATERS && responses >= SMALL_SAMPLE_RESPONSES) return null

  return (
    `Amostra pequena: ${plural(raters, 'avaliador', 'avaliadores')} e ` +
    `${plural(responses, 'resposta avaliada', 'respostas avaliadas')} nesta rodada. ` +
    `Abaixo de ${SMALL_SAMPLE_RATERS} avaliadores ou de ${SMALL_SAMPLE_RESPONSES} ` +
    'respostas avaliadas, o coeficiente oscila muito de uma nota para outra. O corte é ' +
    'convenção desta ferramenta, não da literatura, e o valor acima continua valendo — ' +
    'leia com cautela.'
  )
}

export function notCalculableMessage(reason: NotCalculableReason): string {
  switch (reason) {
    case 'few_evaluators':
      return (
        'Menos de dois avaliadores enviaram avaliação nesta rodada. O coeficiente ' +
        'compara pessoas, e com uma só não há o que comparar: é falta de dado, não erro.'
      )
    case 'no_shared_units':
      return (
        'Há dois ou mais avaliadores, mas nenhuma resposta-célula foi avaliada por dois ' +
        'deles. Os avaliadores ainda não se cruzaram em nenhuma resposta.'
      )
    case 'no_variation':
      return (
        'Todas as notas caíram no mesmo ponto da escala. Sem variação não há ' +
        'concordância por acaso a descontar, e o coeficiente fica indefinido — o que ' +
        'não é o mesmo que concordância perfeita.'
      )
  }
}

export function cellNotCalculableLabel(reason: NotCalculableReason): string {
  switch (reason) {
    case 'few_evaluators':
      return '1 avaliador'
    case 'no_shared_units':
      return 'sem cruzamento'
    case 'no_variation':
      return 'sem variação'
  }
}
