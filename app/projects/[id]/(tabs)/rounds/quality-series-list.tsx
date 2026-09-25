import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { OpenLink } from '@/app/components/ui/open-link'
import { formatDate } from '@/app/notifications/labels'
import { QualityValue } from './quality-panel'
import { QUALITY_SERIES_NOTE, QUALITY_SERIES_NOTE_SINGLE } from './quality-labels'
import type { QualitySeriesPoint } from './quality-series'

export function QualitySeriesList({
  points,
  projectId,
}: {
  points: QualitySeriesPoint[]
  projectId: string
}) {
  return (
    <div className="flex flex-col gap-3">
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
                <span className="text-[13px] text-muted">
                  Prompt v{point.promptVersionNumber}
                </span>
                {point.closedAt ? (
                  <span className="text-[13px] text-muted">
                    fechada em {formatDate(point.closedAt)}
                  </span>
                ) : (
                  <Badge tone="info">aberta</Badge>
                )}
              </div>

              <QualityValue pair={point.pair} />
            </Card>
          </li>
        ))}
      </ul>

      <p className="m-0 text-xs text-muted">
        {points.length === 1 ? QUALITY_SERIES_NOTE_SINGLE : QUALITY_SERIES_NOTE}
      </p>

      <p className="m-0 text-xs">
        <OpenLink href={`/projects/${projectId}/rounds`}>Abrir rodadas</OpenLink>
      </p>
    </div>
  )
}
