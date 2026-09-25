import { plural } from '@/lib/plural'
import { scaleLabel } from '../evaluate/scale'
import { PHASE_2, PHASE_3 } from '../../pipeline/preconditions'
import type { QualityLevel } from './quality'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  CELL_NOT_APPLICABLE,
  CELL_NOT_APPLICABLE_TITLE,
  CELL_UNRATED_LABEL,
} from './agreement-labels'

export const QUALITY_LABEL = 'Qualidade'

export const QUALITY_UNRATED = 'ainda não há notas'

export const QUALITY_UNRATED_WITHOUT_OUTLIERS = 'não sobra nota depois da exclusão'

export const QUALITY_HINT =
  `A distribuição das notas desta rodada entre ${scaleLabel('high')}, ` +
  `${scaleLabel('medium')} e ${scaleLabel('low')}.`

export const QUALITY_HELP =
  `A ${QUALITY_LABEL} é a distribuição das notas desta rodada entre ` +
  `${scaleLabel('high')}, ${scaleLabel('medium')} e ${scaleLabel('low')}, em ` +
  'porcentagem e com a contagem ao lado. Cada nota é uma célula (definição × critério) ' +
  'avaliada por um avaliador numa resposta, e o total é o número de notas, não o de ' +
  'respostas. Arredondadas, as porcentagens podem não somar 100%, e por isso a contagem ' +
  'vem junto. A ferramenta não fixa um alvo para essa distribuição nem diz se o valor ' +
  'basta: quem conhece a tarefa é quem lê o número.'

export const QUALITY_MATRIX_LEGEND =
  'Na matriz, cada célula traz a distribuição das notas daquela definição × critério ' +
  `entre ${scaleLabel('high')}, ${scaleLabel('medium')} e ${scaleLabel('low')}, com a ` +
  `contagem ao lado. “${CELL_UNRATED_LABEL}” é célula que existe no codebook e que ` +
  'ninguém avaliou ainda, e não vale 0%; ' +
  `“${CELL_NOT_APPLICABLE}” é ${CELL_NOT_APPLICABLE_TITLE}, que não se aplica a esta. ` +
  'Com avaliador marcado como outlier, cada célula traz os dois valores, ' +
  `${AGREEMENT_ALL_LABEL} primeiro e ${AGREEMENT_WITHOUT_OUTLIERS_LABEL} depois, ao ` +
  `contrário da matriz de Concordância, que fica só ${AGREEMENT_ALL_LABEL}.`

export const QUALITY_SERIES_HINT =
  `A distribuição das notas de cada rodada da Fase ${PHASE_3}, um ponto por rodada.`

export const QUALITY_SERIES_HELP =
  `Cada ponto é a ${QUALITY_LABEL} de uma rodada da Fase ${PHASE_3} inteira, em ordem ` +
  'cronológica, ao lado das versões de codebook e de prompt que aquela rodada fixou: o ' +
  'número descreve essa combinação de versões, e só ela. Nenhum valor junta rodadas, e ' +
  'nada é somado nem tirado a média entre elas. As rodadas da ' +
  `Fase ${PHASE_2} não entram. Com avaliador marcado como outlier numa rodada, o ponto ` +
  `dela traz também o valor ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}, depois do ` +
  `${AGREEMENT_ALL_LABEL}.`

export const QUALITY_SERIES_NOTE =
  'Um ponto por rodada, e nenhum valor que junte rodadas: cada distribuição descreve as ' +
  'versões de codebook e de prompt indicadas ao lado dela.'

export const QUALITY_SERIES_NOTE_SINGLE =
  'Um ponto por rodada, e nenhum valor que junte rodadas: a próxima rodada da ' +
  `Fase ${PHASE_3} rende o segundo ponto.`

const SHARE_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function formatShare(share: number): string {
  return `${SHARE_FORMAT.format(share * 100)}%`
}

export function qualityTotal(total: number): string {
  return plural(total, 'nota', 'notas')
}

export function levelText(level: QualityLevel): string {
  return `${scaleLabel(level.value)} ${formatShare(level.share)} (${level.count})`
}
