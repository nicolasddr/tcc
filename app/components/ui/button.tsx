import type { ComponentProps } from 'react'
import Link from '@/app/components/app-link'
import { cx } from './cx'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'dangerSolid'
  | 'warning'
  | 'dangerGhost'
  | 'ghost'
  | 'link'
  | 'quiet'

export type ButtonSize = 'md' | 'sm'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold ' +
  'transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default ' +
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ring'

const variants: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-brand text-white not-disabled:hover:bg-brand-hover',
  secondary:
    'border border-line-strong bg-surface text-label not-disabled:hover:bg-canvas',
  danger:
    'border border-line-strong bg-surface text-label ' +
    'not-disabled:hover:bg-danger-tint not-disabled:hover:border-danger-tint-border ' +
    'not-disabled:hover:text-danger-fg',
  dangerSolid:
    'border border-transparent bg-danger text-white not-disabled:hover:bg-danger-hover',
  warning:
    'border border-transparent bg-warning text-warning-on not-disabled:hover:bg-warning-hover',
  dangerGhost:
    'border-0 bg-transparent p-0 text-xs text-danger-fg not-disabled:hover:underline',
  ghost:
    'border-0 bg-transparent px-2 py-1.5 text-sm text-label not-disabled:hover:bg-canvas',
  link: 'border-0 bg-transparent p-0 text-xs text-brand not-disabled:hover:underline',
  quiet:
    'border-0 bg-transparent p-0 text-[13px] whitespace-nowrap text-label ' +
    'not-disabled:hover:text-ink not-disabled:hover:underline',
}

const sizes: Record<ButtonSize, string> = {
  md: 'px-[18px] py-[10px] text-[13px]',
  sm: 'px-3 py-[5px] text-xs',
}

const unsized = new Set<ButtonVariant>(['dangerGhost', 'ghost', 'link', 'quiet'])

export type ButtonOptions = {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
}

export function buttonClass(
  variant: ButtonVariant = 'primary',
  opts: Omit<ButtonOptions, 'variant'> = {},
): string {
  const { size = 'md', fullWidth, className } = opts
  return cx(
    base,
    variants[variant],
    unsized.has(variant) ? undefined : sizes[size],
    fullWidth && 'w-full',
    className,
  )
}

export type ButtonProps = ButtonOptions & {
  loading?: boolean
  loadingText?: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  loadingText,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, { size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && loadingText != null ? loadingText : children}
    </button>
  )
}

export type ButtonLinkProps = ButtonOptions & ComponentProps<typeof Link>

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, { size, fullWidth, className })} {...rest}>
      {children}
    </Link>
  )
}

export function IconButton({
  className,
  children,
  type = 'button',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx(
        'relative inline-flex h-9 w-9 cursor-pointer items-center justify-center',
        'rounded-control border-0 bg-transparent text-label transition-colors',
        'not-disabled:hover:bg-canvas focus-visible:outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-brand-ring',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
