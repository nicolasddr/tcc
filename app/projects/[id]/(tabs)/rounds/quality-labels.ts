import { plural } from '@/lib/plural'
import { scaleLabel } from '../evaluate/scale'

export const QUALITY_LABEL = 'Qualidade'

export const QUALITY_UNRATED = 'ainda não há notas'

export const QUALITY_UNRATED_WITHOUT_OUTLIERS = 'não sobra nota depois da exclusão'

export const QUALITY_HELP =
  `A ${QUALITY_LABEL} é a distribuição das notas desta rodada entre ` +
  `${scaleLabel('high')}, ${scaleLabel('medium')} e ${scaleLabel('low')}, em ` +
  'porcentagem e com a contagem ao lado. Cada nota é uma célula (definição × critério) ' +
  'avaliada por um avaliador numa resposta, e o total é o número de notas, não o de ' +
  'respostas. Arredondadas, as porcentagens podem não somar 100%, e por isso a contagem ' +
  'vem junto. A ferramenta não fixa um alvo para essa distribuição nem diz se o valor ' +
  'basta: quem conhece a tarefa é quem lê o número.'

const SHARE_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function formatShare(share: number): string {
  return `${SHARE_FORMAT.format(share * 100)}%`
}

export function qualityTotal(total: number): string {
  return plural(total, 'nota', 'notas')
}
