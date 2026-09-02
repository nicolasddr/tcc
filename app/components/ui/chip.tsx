import Link from '@/app/components/app-link'
import { cx } from './cx'

const base =
  'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface ' +
  'py-1 pr-[11px] pl-[9px] text-[12.5px] whitespace-nowrap text-label'

const interactive =
  'transition-colors hover:border-line-strong hover:bg-surface-subtle hover:text-brand ' +
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ring'

export type ChipProps = {
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}

function content(icon: React.ReactNode, children: React.ReactNode) {
  return (
    <>
      {icon ? <span className="flex text-faint">{icon}</span> : null}
      {children}
    </>
  )
}

export function Chip({ icon, className, children }: ChipProps) {
  return <span className={cx(base, className)}>{content(icon, children)}</span>
}

export function ChipLink({
  href,
  icon,
  className,
  children,
}: ChipProps & { href: string }) {
  return (
    <Link href={href} className={cx(base, interactive, className)}>
      {content(icon, children)}
    </Link>
  )
}
