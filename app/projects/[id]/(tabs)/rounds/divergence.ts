import { PER_RESPONSE_LABEL } from '../../pipeline/criteria'
import type { AgreementProfile } from '@/lib/agreement'
import { scaleLabel, scaleRank, type ScaleValue } from '../evaluate/scale'
import { formatShare } from './share'

export type CellDivergence = 'unrated' | 'single' | 'unanimous' | 'adjacent' | 'extreme'

export type DivergenceTone = 'neutral' | 'success' | 'warning' | 'danger'

export const NO_JUSTIFICATION_MARK = '—'

export const NO_JUSTIFICATION_HINT =
  `A justificativa é opcional no envio da avaliação: “${NO_JUSTIFICATION_MARK}” quer ` +
  'dizer que o avaliador escolheu não escrever nada naquela nota, e não que o texto ' +
  'deixou de carregar.'

export const DIVERGENCE_LEGEND =
  `“${divergenceLabel('adjacent')}” é nota em pontos vizinhos da escala ` +
  `(${scaleLabel('high')} com ${scaleLabel('medium')}, ou ${scaleLabel('medium')} com ` +
  `${scaleLabel('low')}), e costuma indicar fronteira borrada entre os pontos: as ` +
  'pessoas entenderam a mesma coisa e discordaram de grau, o que pede critério mais ' +
  `preciso na régua. “${divergenceLabel('extreme')}” é ${scaleLabel('high')} com ` +
  `${scaleLabel('low')} na mesma célula, e costuma indicar definição ambígua: duas ` +
  'pessoas leram coisas opostas no mesmo texto, com o mesmo codebook, o que pede ' +
  `descrição mais precisa na definição. “${divergenceLabel('single')}” não é nem uma ` +
  'coisa nem outra — com um avaliador só não há com quem discordar.'

export const DIVERGENCE_PER_RESPONSE_LEGEND =
  `No grupo “${PER_RESPONSE_LABEL}” não há definição: ali a divergência extrema costuma ` +
  'apontar para o próprio critério, e pede descrição mais precisa nele.'

export const DIVERGENCE_BAR_HEADER = 'Notas iguais · adjacente · extrema'

export function divergenceBarLabel(profile: AgreementProfile): string {
  return (
    `${formatShare(profile.equal)} iguais, ` +
    `${formatShare(profile.adjacent)} ${divergenceLabel('adjacent').toLowerCase()}, ` +
    `${formatShare(profile.extreme)} ${divergenceLabel('extreme').toLowerCase()}`
  )
}

export function classifyDivergence(values: readonly ScaleValue[]): CellDivergence {
  if (values.length === 0) return 'unrated'
  if (values.length === 1) return 'single'

  const ranks = values.map(scaleRank)
  const spread = Math.max(...ranks) - Math.min(...ranks)

  if (spread === 0) return 'unanimous'
  return spread === 1 ? 'adjacent' : 'extreme'
}

export function isDivergent(kind: CellDivergence): boolean {
  return kind === 'adjacent' || kind === 'extreme'
}

export function divergenceLabel(kind: CellDivergence): string {
  switch (kind) {
    case 'unrated':
      return 'Sem nota'
    case 'single':
      return '1 nota'
    case 'unanimous':
      return 'Unânime'
    case 'adjacent':
      return 'Divergência adjacente'
    case 'extreme':
      return 'Divergência extrema'
  }
}

export function divergenceTone(kind: CellDivergence): DivergenceTone {
  switch (kind) {
    case 'unrated':
    case 'single':
      return 'neutral'
    case 'unanimous':
      return 'success'
    case 'adjacent':
      return 'warning'
    case 'extreme':
      return 'danger'
  }
}

export function divergenceMeaning(kind: CellDivergence, isPerResponse = false): string {
  switch (kind) {
    case 'unrated':
      return 'Nenhum avaliador deu nota nesta célula.'
    case 'single':
      return (
        'Só um avaliador deu nota nesta célula: não é unanimidade nem divergência, ' +
        'porque não há com quem comparar.'
      )
    case 'unanimous':
      return 'Todos os avaliadores que deram nota caíram no mesmo ponto da escala.'
    case 'adjacent':
      return (
        `As notas ficaram em pontos vizinhos da escala (${scaleLabel('high')} com ` +
        `${scaleLabel('medium')}, ou ${scaleLabel('medium')} com ${scaleLabel('low')}): ` +
        'costuma ser fronteira borrada entre os pontos, e pede critério mais preciso ' +
        'na régua.'
      )
    case 'extreme':
      return isPerResponse
        ? `As notas foram de ${scaleLabel('high')} a ${scaleLabel('low')} na mesma ` +
            'célula: sem definição em jogo, costuma ser o próprio critério que admite ' +
            'leituras opostas, e pede descrição mais precisa nele.'
        : `As notas foram de ${scaleLabel('high')} a ${scaleLabel('low')} na mesma ` +
            'célula: costuma ser definição ambígua, e pede descrição mais precisa na ' +
            'definição.'
  }
}
