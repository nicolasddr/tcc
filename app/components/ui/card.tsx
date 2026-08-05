import { cx } from './cx'

export type CardPadding = 'sm' | 'md' | 'lg'
export type CardTone = 'default' | 'subtle' | 'accent'

const paddings: Record<CardPadding, string> = {
  sm: 'px-[14px] py-3',
  md: 'px-[18px] py-4',
  lg: 'px-5 py-[18px]',
}

const tones: Record<CardTone, string> = {
  default: 'border-line bg-surface',
  subtle: 'border-line bg-surface-subtle',
  accent: 'border-brand-border bg-surface',
}

export const cardInteractiveClass =
  'transition-[border-color,box-shadow] hover:border-brand-border ' +
  'hover:shadow-[0_1px_4px_rgba(0,0,0,0.05)]'

export type CardOptions = {
  padding?: CardPadding
  tone?: CardTone
  interactive?: boolean
  className?: string
}

export function cardClassName({
  padding = 'md',
  tone = 'default',
  interactive,
  className,
}: CardOptions = {}): string {
  return cx(
    'rounded-card border',
    tones[tone],
    paddings[padding],
    interactive && cardInteractiveClass,
    className,
  )
}

export function Card({
  children,
  ...options
}: CardOptions & { children: React.ReactNode }) {
  return <div className={cardClassName(options)}>{children}</div>
}
