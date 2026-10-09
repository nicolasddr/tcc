import Link from '@/app/components/app-link'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { CheckCircleIcon, CircleIcon } from '@/app/components/ui/icons'

export const CHECKLIST_DESTINATIONS = {
  codebook: 'Codebook',
  prompt: 'Prompt',
  items: 'Itens',
  rounds: 'Rodadas',
} as const

export type ChecklistDestination = keyof typeof CHECKLIST_DESTINATIONS

export function PhaseChecklist({
  title,
  badge,
  items,
  className,
  children,
}: {
  title: string
  badge: React.ReactNode
  items: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-[13px] font-semibold text-ink">{title}</h3>
        {badge}
      </div>

      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">{items}</ul>

      {children}
    </div>
  )
}

export function ChecklistItem({
  label,
  status,
  help,
  href,
  destination,
}: {
  label: string
  status: 'pending' | 'done' | 'waiting'
  help?: string
  href?: string
  destination?: ChecklistDestination
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <span className="flex min-w-[220px] flex-1 items-start gap-2 text-[13px]">
        {status === 'done' ? (
          <CheckCircleIcon className="mt-0.5 text-success-fg" />
        ) : (
          <CircleIcon className="mt-0.5 text-faint" />
        )}
        <span className={status === 'pending' ? 'font-semibold text-ink' : 'text-muted'}>
          {label}
          {status === 'done' ? <span className="sr-only"> pronto</span> : null}
          {help ? (
            <span className="ml-1.5">
              <InfoTooltip text={help} />
            </span>
          ) : null}
        </span>
      </span>

      {status === 'pending' && href && destination ? (
        <Link
          href={href}
          className="ml-6 text-[13px] font-semibold text-brand transition-colors hover:text-brand-hover sm:ml-0"
        >
          {`Ir para ${CHECKLIST_DESTINATIONS[destination]}`}
        </Link>
      ) : null}
    </li>
  )
}
