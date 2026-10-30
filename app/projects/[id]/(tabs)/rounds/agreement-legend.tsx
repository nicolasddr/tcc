import { Badge } from '@/app/components/ui/badge'
import { cx } from '@/app/components/ui/cx'
import { bandLegend, bandTone } from './agreement-labels'
import { DIVERGENCE_SEGMENT_CLASS } from './divergence-bar'

const NOTES_LEGEND = [
  { key: 'equal', label: 'iguais' },
  { key: 'adjacent', label: 'divergência adjacente' },
  { key: 'extreme', label: 'divergência extrema' },
] as const

export function AgreementLegend() {
  return (
    <div className="flex flex-wrap gap-x-[22px] gap-y-1.5 text-xs text-muted">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-label">Faixa</span>
        {bandLegend().map(({ band, range, label }) => (
          <span key={band} className="flex items-center gap-1.5">
            <Badge tone={bandTone(band)}>{range}</Badge>
            {label}
          </span>
        ))}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-label">Notas</span>
        {NOTES_LEGEND.map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1">
            <span
              aria-hidden
              className={cx('inline-block size-2.5 rounded-[2px]', DIVERGENCE_SEGMENT_CLASS[key])}
            />
            {label}
          </span>
        ))}
      </span>
    </div>
  )
}
