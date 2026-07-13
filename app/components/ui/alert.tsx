import { cx } from './cx'

// Mensagem em caixa para erro/sucesso/aviso de formulário (.form-error/.form-success/
// .form-notice). Mantém a acessibilidade que as telas já tinham: erro anuncia como "alert",
// sucesso como "status"; o `role` pode ser sobrescrito quando o caso pedir.

export type AlertTone = 'error' | 'success' | 'notice'

const tones: Record<AlertTone, string> = {
  error: 'bg-danger-bg text-danger-fg border-danger-border',
  success: 'bg-success-bg text-success-fg border-success-border',
  notice: 'bg-warning-bg text-warning-fg border-warning-border',
}

const defaultRole: Record<AlertTone, React.AriaRole | undefined> = {
  error: 'alert',
  success: 'status',
  notice: undefined,
}

export function Alert({
  tone,
  role,
  className,
  children,
}: {
  tone: AlertTone
  role?: React.AriaRole
  className?: string
  children: React.ReactNode
}) {
  return (
    <p
      role={role ?? defaultRole[tone]}
      className={cx(
        'rounded-control border px-3 py-[10px] text-[13px]',
        tones[tone],
        className,
      )}
    >
      {children}
    </p>
  )
}
