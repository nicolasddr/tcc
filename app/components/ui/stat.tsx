import { Card } from './card'
import { cx } from './cx'

export function ProgressBar({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}
    >
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function StatCard({
  label,
  value,
  suffix,
  hint,
  badge,
  children,
}: {
  label: string
  value: React.ReactNode
  suffix?: React.ReactNode
  hint?: React.ReactNode
  badge?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Card padding="lg" tone="subtle" className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          {label}
        </span>
        {badge}
      </div>

      <span className="flex items-baseline gap-1.5">
        <span className="text-[26px] leading-none font-bold text-ink">{value}</span>
        {suffix ? <span className="text-[13px] text-muted">{suffix}</span> : null}
      </span>

      {children}

      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </Card>
  )
}
