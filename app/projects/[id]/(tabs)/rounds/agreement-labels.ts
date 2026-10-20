import { plural } from '@/lib/plural'
import type { Agreement, AgreementProfile, NotCalculableReason } from '@/lib/agreement'
import { PHASE_2, PHASE_3, PHASE_4 } from '../../pipeline/preconditions'
import { PER_RESPONSE_LABEL } from '../../pipeline/criteria'
import { SCALE, scaleLabel, scaleRank, type ScaleValue } from '../evaluate/scale'
import { formatShare } from './share'
import { divergenceLabel } from './divergence'

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

export const CELL_PER_RESPONSE_ROW_TITLE =
  'critério de definição, que não se avalia na resposta inteira'

export const CELL_PER_RESPONSE_COLUMN_TITLE =
  'critério por resposta, que se avalia na resposta inteira e não numa definição'

export const CELL_UNRATED_LABEL = 'sem nota'

export const MATRIX_PER_RESPONSE_LEGEND =
  `A linha “${PER_RESPONSE_LABEL}” traz os critérios que julgam a resposta inteira: uma ` +
  `nota por resposta, sem definição. Por isso o “${CELL_NOT_APPLICABLE}” aparece nela nas ` +
  'colunas dos critérios de definição, e nas linhas das definições na coluna do critério ' +
  'por resposta.'

export const BY_DEFINITION_LABEL = 'Por definição'

export const CRITERION_TABLE_NOTE =
  'Cada linha junta as notas do critério em todas as definições que o têm, numa conta só.'

export const CRITERION_TABLE_HELP =
  'É um α sobre essas notas, e não a média das células da matriz. Para ver se alguma ' +
  `definição puxa o número para baixo, veja ${BY_DEFINITION_LABEL}, logo abaixo. Quando as ` +
  'definições são só posições (Query 1, Query 2…), a leitura é esta tabela.'

export function byDefinitionSummary(definitions: number, criteria: number): string {
  return (
    `${BY_DEFINITION_LABEL} (${plural(definitions, 'definição', 'definições')} × ` +
    `${plural(criteria, 'critério', 'critérios')})`
  )
}

export const OUTLIER_PAIR_SUMMARY =
  'Os dois valores saem do mesmo dado desta rodada, e o resultado da rodada continua ' +
  `sendo o ${AGREEMENT_ALL_LABEL}.`

export const OUTLIER_PAIR_RESULT = `O resultado da rodada é o valor ${AGREEMENT_ALL_LABEL}.`

export const OUTLIER_PAIR_POINTS: readonly string[] = [
  `O segundo valor, ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}, refaz a conta retirando as notas ` +
    'de quem foi marcado, para mostrar o quanto a exclusão move o número.',
  'A exclusão é declarada e justificada uma a uma, nunca sugerida pela ferramenta, e ' +
    'nenhuma nota é apagada por causa dela.',
]

export const AGREEMENT_SERIES_POINTS: readonly string[] = [
  'Cada ponto traz a versão de codebook que a rodada fixou e a fase em que ela foi aberta. ' +
    `As Fases ${PHASE_2}, ${PHASE_3} e ${PHASE_4} ficam na mesma série.`,
  `Da última rodada da Fase ${PHASE_2} para a primeira da Fase ${PHASE_3}, com a mesma ` +
    'versão de codebook, a diferença mostra o efeito de a LLM passar a receber o codebook.',
  `Na Fase ${PHASE_3}, o codebook refinado deve aparecer como concordância maior na rodada ` +
    `seguinte. Na Fase ${PHASE_4}, codebook e prompt não mudam: mudam os itens e os ` +
    'avaliadores, e cada rodada se lê ao lado da sua rodada de referência.',
]

export const BAND_REFERENCE_LABEL = 'Faixa de referência'

export const BAND_REFERENCE =
  `${BAND_REFERENCE_LABEL} de ${AGREEMENT_SOURCE}: abaixo de ` +
  `${formatCut(AGREEMENT_BANDS.acceptable)}, questionável; de ` +
  `${formatCut(AGREEMENT_BANDS.acceptable)} a ${formatCut(AGREEMENT_BANDS.good)}, ` +
  `aceitável; ${formatCut(AGREEMENT_BANDS.good)} ou mais, boa. Ela não trava nada no projeto.`

export function cellNotApplicableTitle(
  isPerResponseRow: boolean,
  isPerResponseColumn: boolean,
): string {
  if (isPerResponseRow) return CELL_PER_RESPONSE_ROW_TITLE
  if (isPerResponseColumn) return CELL_PER_RESPONSE_COLUMN_TITLE
  return CELL_NOT_APPLICABLE_TITLE
}

export function matrixVersionLabel(codebookVersionNumber: number): string {
  return `Codebook v${codebookVersionNumber} da rodada`
}

export function matrixVersionNote(codebookVersionNumber: number): string {
  return (
    `A matriz é da versão de codebook que a rodada fixou, Codebook v${codebookVersionNumber}, ` +
    'e não da versão vigente do projeto.'
  )
}

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
      return 'Boa'
    case 'acceptable':
      return 'Aceitável'
    case 'questionable':
      return 'Questionável'
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
  return `${plural(units, 'nota', 'notas')} · ${plural(
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
    `Amostra pequena (${plural(raters, 'avaliador', 'avaliadores')}, ` +
    `${plural(responses, 'resposta', 'respostas')}): leia com cautela.`
  )
}

export const SMALL_SAMPLE_HELP =
  `Abaixo de ${SMALL_SAMPLE_RATERS} avaliadores ou de ${SMALL_SAMPLE_RESPONSES} ` +
  'respostas avaliadas, o coeficiente oscila muito: corte por convenção desta ferramenta, ' +
  'não da literatura. O valor continua valendo.'

export function notCalculableMessage(reason: NotCalculableReason): string {
  switch (reason) {
    case 'few_evaluators':
      return (
        'É preciso que pelo menos dois avaliadores enviem avaliação nesta rodada para que o ' +
        'ICR possa ser calculado.'
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

export const CONCENTRATION_EQUAL = 0.8

export const CONCENTRATION_HELP =
  'É o paradoxo da prevalência: com quase todas as notas num nível só, a discordância ' +
  'esperada ao acaso fica perto de zero, e poucas divergências derrubam o α. O aviso ' +
  `pede α abaixo de ${formatCut(AGREEMENT_BANDS.acceptable)} e ` +
  `${formatShare(CONCENTRATION_EQUAL)} ou mais de notas iguais: corte por convenção desta ` +
  'ferramenta, não da literatura.'

function levelShare(profile: AgreementProfile, value: ScaleValue): number {
  return profile.shares.get(scaleRank(value)) ?? 0
}

export function distributionLine(profile: AgreementProfile): string {
  return SCALE.map(
    (value) => `${scaleLabel(value)} ${formatShare(levelShare(profile, value))}`,
  ).join(' · ')
}

export function equalShareText(profile: AgreementProfile): string {
  return `${formatShare(profile.equal)} de notas iguais`
}

export function profileLine(profile: AgreementProfile): string {
  return (
    `${equalShareText(profile)} · ` +
    `${formatShare(profile.adjacent)} de ${divergenceLabel('adjacent').toLowerCase()} · ` +
    `${formatShare(profile.extreme)} de ${divergenceLabel('extreme').toLowerCase()}`
  )
}

export function concentrationWarning(
  agreement: Agreement,
  profile: AgreementProfile | null,
): string | null {
  if (!profile || !agreement.calculable) return null
  if (agreement.alpha >= AGREEMENT_BANDS.acceptable) return null
  if (profile.equal < CONCENTRATION_EQUAL) return null

  const top = SCALE.reduce((best, value) =>
    levelShare(profile, value) > levelShare(profile, best) ? value : best,
  )

  return (
    `As notas se concentram em ${scaleLabel(top)} (${formatShare(levelShare(profile, top))}), ` +
    `e os avaliadores deram a mesma nota em ${formatShare(profile.equal)} dos pares. Com ` +
    'pouca variação na escala, poucas divergências bastam para derrubar o α. Leia o número ' +
    'junto com a matriz.'
  )
}
