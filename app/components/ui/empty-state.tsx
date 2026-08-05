import { cx } from './cx'

export function EmptyState({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <p
      className={cx(
        'm-0 rounded-card border border-dashed border-line-strong p-7',
        'text-center text-sm text-muted',
        className,
      )}
    >
      {children}
    </p>
  )
}
