import { cx } from './cx'

// Pílula de status. Havia três desenhos idênticos em CSS (.status-badge, .onboarding-badge,
// .member-status) mudando só as cores por classe de estado. Aqui o formato é um só e a cor
// vem do `tone`. StatusBadge mapeia o status cru (projeto ou membro) para o tom certo, para
// o chamador não repetir esse de/para.

export type BadgeTone = 'success' | 'info' | 'neutral' | 'warning' | 'danger'

const tones: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success-fg',
  info: 'bg-info-bg text-info-fg',
  neutral: 'bg-neutral-bg text-neutral-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cx(
        'rounded-full px-[9px] py-[3px] text-[11px] font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// De/para de status → tom. Cobre estados de projeto (active/completed/archived) e de membro
// (pending_onboarding/inactive); o rótulo visível continua vindo do chamador (children).
const statusTone: Record<string, BadgeTone> = {
  active: 'success',
  completed: 'info',
  archived: 'neutral',
  pending_onboarding: 'warning',
  inactive: 'neutral',
}

export function StatusBadge({
  status,
  children,
}: {
  status: string
  children: React.ReactNode
}) {
  return <Badge tone={statusTone[status] ?? 'neutral'}>{children}</Badge>
}
