import { cx } from './cx'

// Botão único para todas as ações de formulário. Antes cada tela repetia .btn-role-primary,
// .btn-invite, .btn-accept (idênticos), .btn-secondary/.btn-role-outline (idênticos) e
// .btn-decline em CSS artesanal; aqui isso vira `variant`. O estado de carregamento segue o
// padrão do submit-button.tsx (disabled + aria-busy + troca opcional do rótulo) — o
// SubmitButton apenas liga esse estado ao useFormStatus.

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerGhost'
export type ButtonSize = 'md' | 'sm'

const base =
  'inline-flex items-center justify-center rounded-control font-semibold ' +
  'transition-colors disabled:opacity-60 disabled:cursor-default'

const variants: Record<ButtonVariant, string> = {
  // Ação principal azul (btn-role-primary / btn-invite / btn-accept).
  primary: 'border border-transparent bg-brand text-white hover:enabled:bg-brand-hover',
  // Ação secundária de contorno (btn-secondary / btn-role-outline).
  secondary:
    'border border-line-strong bg-transparent text-label hover:enabled:bg-canvas',
  // Destrutivo discreto: contorno neutro que fica vermelho ao passar o mouse (btn-decline).
  danger:
    'border border-line-strong bg-surface text-label ' +
    'hover:enabled:bg-danger-tint hover:enabled:border-danger-tint-border hover:enabled:text-danger-fg',
  // Destrutivo em linha, sem caixa (member-remove): só texto vermelho que sublinha no hover.
  // Traz o próprio tamanho de fonte porque ignora as classes de `size` (que dão padding).
  dangerGhost:
    'border-0 bg-transparent p-0 text-xs text-danger-fg hover:enabled:underline',
}

// Tamanhos reproduzem os paddings/fontes recorrentes. `dangerGhost` ignora padding próprio.
const sizes: Record<ButtonSize, string> = {
  md: 'px-[18px] py-[10px] text-[13px]',
  sm: 'px-3 py-[5px] text-xs',
}

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Ocupa a largura total (uso em bloco, como o antigo btn-role-primary). */
  fullWidth?: boolean
  /** Em andamento: desabilita, marca aria-busy e troca o rótulo por `loadingText`. */
  loading?: boolean
  loadingText?: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function buttonClass(
  variant: ButtonVariant = 'primary',
  opts: { size?: ButtonSize; fullWidth?: boolean; className?: string } = {},
): string {
  const { size = 'md', fullWidth, className } = opts
  return cx(
    base,
    variants[variant],
    variant === 'dangerGhost' ? undefined : sizes[size],
    fullWidth && 'w-full',
    className,
  )
}

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
