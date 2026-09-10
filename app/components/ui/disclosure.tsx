import { cx } from './cx'
import { ChevronRightIcon } from './icons'

const summaryBase =
  'inline-flex cursor-pointer list-none items-center gap-1.5 rounded-control ' +
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ring ' +
  '[&::-webkit-details-marker]:hidden'

const summaryDefault = 'text-[12.5px] font-semibold text-muted'

export type DisclosureProps = {
  summary: React.ReactNode
  defaultOpen?: boolean
  chevron?: boolean
  summaryClassName?: string
} & Omit<React.ComponentProps<'details'>, 'open'>

export function Disclosure({
  summary,
  defaultOpen,
  chevron = true,
  summaryClassName,
  className,
  children,
  ...rest
}: DisclosureProps) {
  return (
    <details className={cx('group', className)} open={defaultOpen || undefined} {...rest}>
      <summary className={cx(summaryBase, summaryClassName ?? summaryDefault)}>
        {chevron ? (
          <ChevronRightIcon className="transition-transform group-open:rotate-90" />
        ) : null}
        {summary}
      </summary>
      {children}
    </details>
  )
}
