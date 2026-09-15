import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { OpenLink } from '@/app/components/ui/open-link'
import { formatDate } from '@/app/notifications/labels'
import { AgreementValue } from './agreement-panel'
import {
  AGREEMENT_BANDS,
  BAND_REFERENCE,
  agreementBand,
  bandTone,
  type BandTone,
} from './agreement-labels'
import type { SeriesPoint } from './agreement-series'

const CHART_HEIGHT = 96

const CHART_WIDTH = 100

const COLUMN_RATIO = 0.55

const SLOT_MAX_PX = 120

const columnFill: Record<BandTone, string> = {
  success: 'fill-success-fg',
  warning: 'fill-warning-fg',
  danger: 'fill-danger-fg',
}

function cutLine(cut: number): number {
  return CHART_HEIGHT - cut * CHART_HEIGHT
}

function SeriesColumns({ points }: { points: SeriesPoint[] }) {
  const slot = CHART_WIDTH / points.length
  const columnWidth = slot * COLUMN_RATIO

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 1}`}
      preserveAspectRatio="none"
      className="h-24 w-full"
      style={{ maxWidth: `${points.length * SLOT_MAX_PX}px` }}
    >
      {[AGREEMENT_BANDS.acceptable, AGREEMENT_BANDS.good].map((cut) => (
        <line
          key={cut}
          x1={0}
          x2={CHART_WIDTH}
          y1={cutLine(cut)}
          y2={cutLine(cut)}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
          className="stroke-line-strong"
        />
      ))}

      <line
        x1={0}
        x2={CHART_WIDTH}
        y1={CHART_HEIGHT}
        y2={CHART_HEIGHT}
        vectorEffect="non-scaling-stroke"
        className="stroke-line-strong"
      />

      {points.map((point, index) => {
        if (!point.agreement.calculable) return null
        const height = Math.max(0, Math.min(1, point.agreement.alpha)) * CHART_HEIGHT

        return (
          <rect
            key={point.roundId}
            x={index * slot + (slot - columnWidth) / 2}
            y={CHART_HEIGHT - height}
            width={columnWidth}
            height={height}
            className={columnFill[bandTone(agreementBand(point.agreement.alpha))]}
          />
        )
      })}
    </svg>
  )
}

export function AgreementSeriesChart({
  points,
  projectId,
}: {
  points: SeriesPoint[]
  projectId: string
}) {
  const roundsHref = `/projects/${projectId}/rounds`

  if (points.length === 0) {
    return (
      <EmptyState>
        Nenhuma rodada ainda. A série começa na primeira rodada, e cada rodada rende um
        ponto sobre a versão de codebook que ela fixou.{' '}
        <OpenLink href={roundsHref}>Abrir rodadas</OpenLink>
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <SeriesColumns points={points} />

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {points.map((point) => (
          <li key={point.roundId}>
            <Card tone="subtle" padding="sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-ink">
                  Rodada {point.roundNumber}
                </span>
                <span className="text-[13px] text-muted">
                  Codebook v{point.codebookVersionNumber}
                </span>
                {point.closedAt ? (
                  <span className="text-[13px] text-muted">
                    fechada em {formatDate(point.closedAt)}
                  </span>
                ) : (
                  <Badge tone="info">aberta</Badge>
                )}
              </div>

              <AgreementValue agreement={point.agreement} />
            </Card>
          </li>
        ))}
      </ul>

      <p className="m-0 text-xs text-muted">
        {points.length === 1
          ? 'Um ponto por rodada, e nenhum valor que junte rodadas: a comparação começa na segunda rodada. '
          : 'Um ponto por rodada, e nenhum valor que junte rodadas: cada coeficiente mede a versão de codebook indicada ao lado dele. '}
        {BAND_REFERENCE}
      </p>

      <p className="m-0 text-xs">
        <OpenLink href={roundsHref}>Abrir rodadas</OpenLink>
      </p>
    </div>
  )
}
