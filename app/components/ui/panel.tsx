import { Card, type CardTone } from './card'
import { cx } from './cx'

export function Panel({
  title,
  icon,
  action,
  className,
  children,
}: {
  title: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card padding="lg" className={cx('flex flex-col', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold text-ink">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

export function Callout({
  title,
  hint,
  action,
  tone = 'default',
  className,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  action?: React.ReactNode
  tone?: CardTone
  className?: string
}) {
  return (
    <Card
      padding="lg"
      tone={tone}
      className={cx('flex flex-wrap items-center justify-between gap-4', className)}
    >
      <div className="min-w-[240px] flex-1">
        <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
        {hint ? <p className="mt-1 text-[13px] text-muted">{hint}</p> : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div>
      ) : null}
    </Card>
  )
}
