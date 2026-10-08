import { Badge } from '@/app/components/ui/badge'
import { Disclosure } from '@/app/components/ui/disclosure'
import { OpenLink } from '@/app/components/ui/open-link'
import { formatDate } from '@/app/notifications/labels'
import type { Quality } from './quality'
import { QualityBar, QualityScaleLegend } from './quality-bar'
import { QualityValue } from './quality-panel'
import {
  QUALITY_SERIES_NOTE,
  QUALITY_SERIES_NOTE_SINGLE,
  QUALITY_SERIES_NUMBERS,
  QUALITY_UNRATED,
  QUALITY_UNRATED_WITHOUT_OUTLIERS,
  levelsText,
  qualityTotal,
} from './quality-labels'
import type { QualitySeriesPoint } from './quality-series'
import { phaseRuns } from './agreement-series'
import { AGREEMENT_ALL_LABEL, AGREEMENT_WITHOUT_OUTLIERS_LABEL } from './agreement-labels'

function SeriesBar({
  quality,
  unrated,
  label,
  size,
}: {
  quality: Quality
  unrated: string
  label?: string
  size: 'md' | 'sm'
}) {
  if (!quality.rated) {
    return (
      <span className="text-xs text-muted">{label ? `${label}: ${unrated}` : unrated}</span>
    )
  }

  const detail = `${levelsText(quality.levels)} · ${qualityTotal(quality.total)}`

  return (
    <QualityBar
      levels={quality.levels}
      size={size}
      title={label ? `${label}: ${detail}` : detail}
    />
  )
}

function PointBars({ point }: { point: QualitySeriesPoint }) {
  const { all, withoutOutliers } = point.pair

  if (!withoutOutliers) {
    return <SeriesBar quality={all} unrated={QUALITY_UNRATED} size="md" />
  }

  return (
    <span className="flex flex-col gap-1">
      <SeriesBar quality={all} unrated={QUALITY_UNRATED} label={AGREEMENT_ALL_LABEL} size="md" />
      <SeriesBar
        quality={withoutOutliers}
        unrated={QUALITY_UNRATED_WITHOUT_OUTLIERS}
        label={AGREEMENT_WITHOUT_OUTLIERS_LABEL}
        size="sm"
      />
      {withoutOutliers.rated ? (
        <span className="text-[11px] text-muted">{AGREEMENT_WITHOUT_OUTLIERS_LABEL}</span>
      ) : null}
    </span>
  )
}

function PointStatus({ point }: { point: QualitySeriesPoint }) {
  return point.closedAt ? (
    <span>fechada em {formatDate(point.closedAt)}</span>
  ) : (
    <Badge tone="info">aberta</Badge>
  )
}

export function QualitySeriesList({
  points,
  projectId,
}: {
  points: QualitySeriesPoint[]
  projectId: string
}) {
  return (
    <div className="flex flex-col gap-3">
      {phaseRuns(points).map((run) => (
        <div key={run.points[0].roundId} className="flex flex-col gap-2">
          <h3 className="m-0 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
            Fase {run.phase}
          </h3>
          <ul className="m-0 grid list-none grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 p-0">
            {run.points.map((point) => (
              <li
                key={point.roundId}
                className="col-span-2 grid grid-cols-subgrid items-center"
              >
                <span className="flex flex-col">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                    Rodada {point.roundNumber}
                    {point.closedAt ? null : <Badge tone="info">aberta</Badge>}
                  </span>
                  <span className="text-xs text-muted">
                    Codebook v{point.codebookVersionNumber} · Prompt v
                    {point.promptVersionNumber}
                  </span>
                </span>
                <PointBars point={point} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      <QualityScaleLegend />

      <Disclosure summary={QUALITY_SERIES_NUMBERS}>
        <ul className="m-0 mt-2 flex list-none flex-col gap-2.5 p-0">
          {points.map((point) => (
            <li key={point.roundId}>
              <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                <span className="font-semibold text-ink">Rodada {point.roundNumber}</span>
                <span>
                  Codebook v{point.codebookVersionNumber} · Prompt v{point.promptVersionNumber}{' '}
                  · Fase {point.phase}
                </span>
                <PointStatus point={point} />
              </p>
              <QualityValue pair={point.pair} />
            </li>
          ))}
        </ul>
      </Disclosure>

      <p className="m-0 text-xs text-muted">
        {points.length === 1 ? QUALITY_SERIES_NOTE_SINGLE : QUALITY_SERIES_NOTE}
      </p>

      <p className="m-0 text-xs">
        <OpenLink href={`/projects/${projectId}/rounds`}>Abrir rodadas</OpenLink>
      </p>
    </div>
  )
}
