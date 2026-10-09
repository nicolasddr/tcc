import { Badge } from '@/app/components/ui/badge'
import { cx } from '@/app/components/ui/cx'
import { scaleLabel, scaleRank, type ScaleValue } from './scale'

const HEIGHTS = ['h-1.5', 'h-[9px]', 'h-3']

export function ScaleMarker({ value }: { value: ScaleValue }) {
  const rank = scaleRank(value)

  return (
    <span aria-hidden className="inline-flex shrink-0 items-end gap-0.5">
      {HEIGHTS.map((height, index) => (
        <span
          key={height}
          className={cx(
            'block w-1 rounded-[1px]',
            height,
            index < rank ? 'bg-quality-high' : 'border border-line',
          )}
        />
      ))}
    </span>
  )
}

export function ScaleBadge({ value }: { value: ScaleValue }) {
  return (
    <Badge className="inline-flex items-center gap-1.5 border border-line-strong bg-surface! py-[2px]! text-ink!">
      <ScaleMarker value={value} />
      {scaleLabel(value)}
    </Badge>
  )
}
