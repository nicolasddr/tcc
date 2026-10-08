import { formatDate } from '@/app/notifications/labels'
import type { Agreement } from '@/lib/agreement'
import { SCALE, scaleLabel, type ScaleValue } from '../evaluate/scale'
import { PHASE_3 } from '../../pipeline/preconditions'
import {
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  NOT_CALCULABLE_LABEL,
  formatAlpha,
} from './agreement-labels'
import type { Quality } from './quality'
import {
  QUALITY_UNRATED,
  QUALITY_UNRATED_WITHOUT_OUTLIERS,
  formatShare,
  levelsShareText,
} from './quality-labels'
import type { ComparedRound } from './reference-comparison'

export const REFERENCE_COMPARISON_TITLE = 'Comparação com a rodada de referência'

export const REFERENCE_COMPARISON_HELP =
  'A rodada de referência é a que validou as versões de codebook e de prompt que a Fase 4 ' +
  'testa. Os dois lados vêm do mesmo cálculo da lista de rodadas, cada um com as suas notas ' +
  'e as suas marcas de outlier. A ferramenta não diz se a diferença basta: quem lê é você.'

export function referenceComparisonHint(roundNumber: number, referenceNumber: number): string {
  return (
    `A rodada ${roundNumber} ao lado da rodada ${referenceNumber}, a última fechada da ` +
    `Fase ${PHASE_3} antes dela.`
  )
}

export const COMPARISON_AGREEMENT_ROW = 'ICR'

export const COMPARISON_TOTAL_ROW = 'Notas'

export const COMPARISON_EMPTY = '—'

export type ComparisonCell = { text: string; count?: number; muted?: boolean } | null

export type ComparisonRow = {
  key: string
  label: string
  level?: ScaleValue
  secondary: boolean
  cells: ComparisonCell[]
}

type Versions = { codebookVersionNumber: number; promptVersionNumber: number }

function versionsText(round: Versions): string {
  return `Codebook v${round.codebookVersionNumber} · Prompt v${round.promptVersionNumber}`
}

export function comparedVersions(
  reference: Versions & { roundNumber: number },
  round: Versions & { roundNumber: number },
): string {
  if (versionsText(reference) === versionsText(round)) return `${versionsText(round)} nas duas`
  return [reference, round]
    .map((side) => `Rodada ${side.roundNumber}: ${versionsText(side)}`)
    .join(' · ')
}

export function comparedPhase(round: { phase: number }, isReference: boolean): string {
  return isReference ? `Fase ${round.phase} · referência` : `Fase ${round.phase}`
}

export function closedOn(closedAt: string): string {
  return `fechada em ${formatDate(closedAt)}`
}

function agreementCell(agreement: Agreement | null): ComparisonCell {
  if (!agreement) return null
  return agreement.calculable
    ? { text: formatAlpha(agreement.alpha) }
    : { text: NOT_CALCULABLE_LABEL, muted: true }
}

function levelCell(quality: Quality | null | undefined, value: ScaleValue): ComparisonCell {
  if (!quality?.rated) return null
  const level = quality.levels.find((candidate) => candidate.value === value)
  return level ? { text: formatShare(level.share), count: level.count } : null
}

function totalCell(quality: Quality | null | undefined, unrated: string): ComparisonCell {
  if (!quality) return null
  return quality.rated ? { text: String(quality.total) } : { text: unrated, muted: true }
}

function withoutOutliers(label: string): string {
  return `${label} ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`
}

export function comparisonRows(
  reference: ComparedRound,
  round: ComparedRound,
): ComparisonRow[] {
  const sides = [reference, round]
  const agreementOutliers = sides.some((side) => side.agreement.withoutOutliers !== null)
  const qualityOutliers = sides.some((side) => (side.quality?.withoutOutliers ?? null) !== null)

  const rows: ComparisonRow[] = [
    {
      key: 'agreement',
      label: COMPARISON_AGREEMENT_ROW,
      secondary: false,
      cells: sides.map((side) => agreementCell(side.agreement.all)),
    },
  ]
  if (agreementOutliers) {
    rows.push({
      key: 'agreement-without',
      label: withoutOutliers(COMPARISON_AGREEMENT_ROW),
      secondary: true,
      cells: sides.map((side) => agreementCell(side.agreement.withoutOutliers)),
    })
  }

  for (const value of SCALE) {
    rows.push({
      key: value,
      label: scaleLabel(value),
      level: value,
      secondary: false,
      cells: sides.map((side) => levelCell(side.quality?.all, value)),
    })
    if (qualityOutliers) {
      rows.push({
        key: `${value}-without`,
        label: withoutOutliers(scaleLabel(value)),
        secondary: true,
        cells: sides.map((side) => levelCell(side.quality?.withoutOutliers, value)),
      })
    }
  }

  rows.push({
    key: 'total',
    label: COMPARISON_TOTAL_ROW,
    secondary: true,
    cells: sides.map((side) => totalCell(side.quality?.all, QUALITY_UNRATED)),
  })
  if (qualityOutliers) {
    rows.push({
      key: 'total-without',
      label: withoutOutliers(COMPARISON_TOTAL_ROW),
      secondary: true,
      cells: sides.map((side) =>
        side.quality?.withoutOutliers
          ? totalCell(side.quality.withoutOutliers, QUALITY_UNRATED_WITHOUT_OUTLIERS)
          : null,
      ),
    })
  }

  return rows
}

function referenceQualityText(quality: Quality | null | undefined): string | null {
  if (!quality) return null
  return quality.rated ? levelsShareText(quality.levels) : QUALITY_UNRATED
}

export function referenceLine(reference: ComparedRound): string {
  const agreement = reference.agreement.all
  const alpha = agreement.calculable ? formatAlpha(agreement.alpha) : NOT_CALCULABLE_LABEL
  return [
    `Referência: rodada ${reference.roundNumber}`,
    `${COMPARISON_AGREEMENT_ROW} ${alpha}`,
    referenceQualityText(reference.quality?.all),
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

export function noReferenceMessage(roundNumber: number): string {
  return (
    `Não há rodada fechada da Fase ${PHASE_3} antes da rodada ${roundNumber}, e por isso não ` +
    'há com o que comparar.'
  )
}
