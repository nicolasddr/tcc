import { scaleLabel, scaleRank, type ScaleValue } from '../evaluate/scale'

export type CellDivergence = 'unrated' | 'single' | 'unanimous' | 'adjacent' | 'extreme'

export type DivergenceTone = 'neutral' | 'success' | 'warning' | 'danger'

export const NO_JUSTIFICATION_LABEL = 'sem justificativa'

export const NO_JUSTIFICATION_HINT =
  `A justificativa é opcional no envio da avaliação: “${NO_JUSTIFICATION_LABEL}” quer ` +
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
      return 'sem nota'
    case 'single':
      return '1 nota'
    case 'unanimous':
      return 'unânime'
    case 'adjacent':
      return 'divergência adjacente'
    case 'extreme':
      return 'divergência extrema'
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

export function divergenceMeaning(kind: CellDivergence): string {
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
      return (
        `As notas foram de ${scaleLabel('high')} a ${scaleLabel('low')} na mesma ` +
        'célula: costuma ser definição ambígua, e pede descrição mais precisa na ' +
        'definição.'
      )
  }
}
