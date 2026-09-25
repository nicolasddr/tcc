import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { OpenLink } from '@/app/components/ui/open-link'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { formatDate } from '@/app/notifications/labels'
import { AgreementValue } from './agreement-panel'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_BANDS,
  BAND_REFERENCE,
  agreementBand,
  bandTone,
  type BandTone,
} from './agreement-labels'
import { phaseRuns, type PhaseRun, type SeriesPoint } from './agreement-series'

const CHART_HEIGHT = 96

const CHART_WIDTH = 100

const COLUMN_RATIO = 0.55

const SLOT_MAX_PX = 120

const OUTLIER_MARK_HEIGHT = 2

const OUTLIER_MARK_LABEL = 'com exclusão'

const OUTLIER_MARK_TITLE =
  'Nesta rodada há avaliador marcado como outlier. A coluna continua sendo o valor ' +
  `${AGREEMENT_ALL_LABEL}; o par com e sem os marcados está na lista de rodadas.`

const OUTLIER_SERIES_NOTE =
  `A série desenha sempre o valor ${AGREEMENT_ALL_LABEL}, porque cada rodada tem o seu ` +
  'próprio conjunto de marcados e os valores filtrados não seriam comparáveis entre si. ' +
  `A marca “${OUTLIER_MARK_LABEL}” diz quais rodadas têm exclusão; o par com e sem os ` +
  'marcados aparece em cada rodada.'

const columnFill: Record<BandTone, string> = {
  success: 'fill-success-fg',
  warning: 'fill-warning-fg',
  danger: 'fill-danger-fg',
}

function cutLine(cut: number): number {
  return CHART_HEIGHT - cut * CHART_HEIGHT
}

function phaseBoundaries(runs: readonly PhaseRun[]): number[] {
  const boundaries: number[] = []
  let index = 0
  for (const run of runs) {
    if (index > 0) boundaries.push(index)
    index += run.points.length
  }
  return boundaries
}

function SeriesColumns({
  points,
  runs,
}: {
  points: SeriesPoint[]
  runs: PhaseRun[]
}) {
  const slot = CHART_WIDTH / points.length
  const columnWidth = slot * COLUMN_RATIO

  return (
    <div
      className="flex w-full flex-col gap-1"
      style={{ maxWidth: `${points.length * SLOT_MAX_PX}px` }}
    >
      <svg
        aria-hidden
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 1}`}
        preserveAspectRatio="none"
        className="h-24 w-full"
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

        {phaseBoundaries(runs).map((index) => (
          <line
            key={`phase-${index}`}
            x1={index * slot}
            x2={index * slot}
            y1={0}
            y2={CHART_HEIGHT}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            className="stroke-line-strong"
          />
        ))}

        {points.map((point, index) => {
          const x = index * slot + (slot - columnWidth) / 2
          const height = point.agreement.calculable
            ? Math.max(0, Math.min(1, point.agreement.alpha)) * CHART_HEIGHT
            : 0

          return (
            <g key={point.roundId}>
              {point.agreement.calculable ? (
                <rect
                  x={x}
                  y={CHART_HEIGHT - height}
                  width={columnWidth}
                  height={height}
                  className={columnFill[bandTone(agreementBand(point.agreement.alpha))]}
                />
              ) : null}

              {point.hasOutlier ? (
                <rect
                  x={x}
                  y={Math.max(0, CHART_HEIGHT - height - OUTLIER_MARK_HEIGHT * 2)}
                  width={columnWidth}
                  height={OUTLIER_MARK_HEIGHT}
                  className="fill-warning-fg"
                >
                  <title>{OUTLIER_MARK_TITLE}</title>
                </rect>
              ) : null}
            </g>
          )
        })}
      </svg>

      <div aria-hidden className="flex w-full text-xs text-muted">
        {runs.map((run) => (
          <span
            key={run.points[0].roundId}
            className="min-w-0 text-center"
            style={{ flex: run.points.length }}
          >
            Fase {run.phase}
          </span>
        ))}
      </div>
    </div>
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

  const runs = phaseRuns(points)

  return (
    <div className="flex flex-col gap-3">
      <SeriesColumns points={points} runs={runs} />

      {runs.map((run) => (
        <div key={run.points[0].roundId} className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-semibold text-ink">Fase {run.phase}</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {run.points.map((point) => (
              <li key={point.roundId}>
                <Card tone="subtle" padding="sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-ink">
                      Rodada {point.roundNumber}
                    </span>
                    <span className="text-[13px] text-muted">
                      Codebook v{point.codebookVersionNumber} · Fase {point.phase}
                    </span>
                    {point.closedAt ? (
                      <span className="text-[13px] text-muted">
                        fechada em {formatDate(point.closedAt)}
                      </span>
                    ) : (
                      <Badge tone="info">aberta</Badge>
                    )}
                    {point.hasOutlier ? (
                      <span title={OUTLIER_MARK_TITLE}>
                        <Badge tone="warning">{OUTLIER_MARK_LABEL}</Badge>
                      </span>
                    ) : null}
                  </div>

                  <AgreementValue
                    pair={{
                      all: point.agreement,
                      withoutOutliers: null,
                      excluded: 0,
                    }}
                  />
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="m-0 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          {points.length === 1
            ? 'Um ponto por rodada, e nenhum valor que junte rodadas: a comparação começa na segunda rodada.'
            : 'Um ponto por rodada, e nenhum valor que junte rodadas: cada coeficiente mede a versão de codebook e a fase indicadas ao lado dele.'}
        </span>
        <InfoTooltip
          text={
            points.some((point) => point.hasOutlier)
              ? `${BAND_REFERENCE}\n\n${OUTLIER_SERIES_NOTE}`
              : BAND_REFERENCE
          }
        />
      </p>

      <p className="m-0 text-xs">
        <OpenLink href={roundsHref}>Abrir rodadas</OpenLink>
      </p>
    </div>
  )
}
