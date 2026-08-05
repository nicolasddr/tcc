import { cx } from './cx'

export const labelClass = 'text-[13px] font-semibold text-label'

export const controlClass =
  'w-full rounded-control border border-line-strong bg-surface px-[11px] py-[9px] ' +
  'text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring'

export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode
  required?: boolean
  hint?: React.ReactNode
  error?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className={labelClass}>
        {label} {required ? <span className="text-danger-fg-strong">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      {error ? (
        <span className="text-[13px] text-danger-fg" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function Fieldset({
  legend,
  className,
  children,
}: {
  legend: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className={cx('m-0 border-0 p-0', className)}>
      <legend className={cx(labelClass, 'mb-2.5 p-0')}>{legend}</legend>
      {children}
    </fieldset>
  )
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlClass, className)} {...rest} />
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(controlClass, 'resize-y', className)} {...rest} />
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select
        className={cx(
          controlClass,
          'cursor-pointer appearance-none pr-9',
          '[-webkit-appearance:none] [-moz-appearance:none]',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  )
}

export function Choice({
  align = 'center',
  className,
  children,
  ...rest
}: {
  align?: 'center' | 'start'
  children: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cx(
        'flex cursor-pointer gap-2.5 text-sm text-label',
        align === 'center' ? 'items-center' : 'items-start',
        className,
      )}
    >
      <input
        className={cx(
          'h-4 w-4 shrink-0 accent-brand',
          align === 'start' && 'mt-[2px]',
        )}
        {...rest}
      />
      {children}
    </label>
  )
}
