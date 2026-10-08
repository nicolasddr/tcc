import { cx } from '@/app/components/ui/cx'
import { scaleLabel, type ScaleValue } from '../evaluate/scale'
import type { QualityLevel } from './quality'
import { formatShare, levelText } from './quality-labels'

const TONE: Record<ScaleValue, string> = {
  high: 'bg-quality-high',
  medium: 'bg-quality-medium',
  low: 'bg-quality-low',
}

const HEIGHT = { md: 'h-2', sm: 'h-1.5' }

export function QualityBar({
  levels,
  size = 'md',
}: {
  levels: QualityLevel[]
  size?: keyof typeof HEIGHT
}) {
  return (
    <div
      aria-hidden
      className={cx('flex w-full overflow-hidden rounded-full bg-line', HEIGHT[size])}
    >
      {levels.map((level) => (
        <span
          key={level.value}
          title={levelText(level)}
          className={cx('h-full', TONE[level.value])}
          style={{ width: `${level.share * 100}%` }}
        />
      ))}
    </div>
  )
}

export function QualitySwatch({ value }: { value: ScaleValue }) {
  return <span aria-hidden className={cx('inline-block size-2 rounded-[2px]', TONE[value])} />
}

export function QualityLegend({ levels }: { levels: QualityLevel[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[13px] text-ink tabular-nums">
      {levels.map((level) => (
        <li key={level.value} className="flex items-center gap-1.5">
          <QualitySwatch value={level.value} />
          <span>
            <span className="font-semibold">{scaleLabel(level.value)}</span>{' '}
            {formatShare(level.share)} <span className="text-muted">({level.count})</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
