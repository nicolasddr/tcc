import Link from '@/app/components/app-link'
import { cx } from './cx'

export type ShellWidth = 'narrow' | 'wide'

const widths: Record<ShellWidth, string> = {
  narrow: 'max-w-[640px]',
  wide: 'max-w-[960px]',
}

export function PageShell({
  header,
  footer,
  width = 'narrow',
  background = 'canvas',
  className,
  children,
}: {
  header?: React.ReactNode
  footer?: React.ReactNode
  width?: ShellWidth
  background?: 'canvas' | 'surface'
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cx(
        'flex flex-1 flex-col text-ink',
        background === 'canvas' ? 'bg-canvas' : 'bg-surface',
        className,
      )}
    >
      {header}
      <main className="flex-1">
        <div className={cx('mx-auto px-6 pt-8 pb-20', widths[width])}>{children}</div>
      </main>
      {footer}
    </div>
  )
}

export function TopBar({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <header
      className={cx(
        'flex items-center gap-4 border-b border-line bg-surface px-6 py-3',
        className,
      )}
    >
      {children}
    </header>
  )
}

export function BackLink({
  href,
  children = 'Voltar',
}: {
  href: string
  children?: React.ReactNode
}) {
  return (
    <Link href={href} className="text-sm text-label transition-colors hover:text-ink">
      ← {children}
    </Link>
  )
}

export function PageTitle({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <h1 className={cx('m-0 text-[22px] font-bold text-ink', className)}>{children}</h1>
  )
}

export function PageSubtitle({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <p className={cx('mt-1.5 mb-6 text-sm text-muted', className)}>{children}</p>
  )
}
