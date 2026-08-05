import Link from '@/app/components/app-link'
import { cx } from './cx'

const base =
  'inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 ' +
  'text-[13px] font-semibold whitespace-nowrap transition-colors'

export function TabList({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <div
        role="tablist"
        className="inline-flex gap-1 rounded-[10px] border border-line bg-surface-subtle p-1"
      >
        {children}
      </div>
    </div>
  )
}

export function Tab({
  icon,
  href,
  active,
  hint,
  children,
}: {
  icon?: React.ReactNode
  href?: string
  active?: boolean
  hint?: string
  children: React.ReactNode
}) {
  if (active) {
    return (
      <span
        role="tab"
        aria-selected="true"
        className={cx(
          base,
          'border-line bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
        )}
      >
        {icon}
        {children}
      </span>
    )
  }

  if (href) {
    return (
      <Link
        role="tab"
        href={href}
        className={cx(base, 'border-transparent text-muted hover:text-ink')}
      >
        {icon}
        {children}
      </Link>
    )
  }

  return (
    <span
      role="tab"
      aria-selected="false"
      aria-disabled="true"
      title={hint}
      className={cx(base, 'cursor-not-allowed border-transparent text-faint')}
    >
      {icon}
      {children}
    </span>
  )
}
