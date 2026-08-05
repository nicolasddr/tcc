import { cx } from './cx'

const gaps = {
  md: 'gap-5',
  sm: 'gap-3.5',
} as const

export function Form({
  gap = 'md',
  className,
  children,
  ...rest
}: { gap?: keyof typeof gaps } & React.ComponentProps<'form'>) {
  return (
    <form className={cx('flex flex-col', gaps[gap], className)} {...rest}>
      {children}
    </form>
  )
}

export function FormActions({
  align = 'end',
  className,
  children,
}: {
  align?: 'start' | 'end'
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-3',
        align === 'end' ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      {children}
    </div>
  )
}
