import Link from '@/app/components/app-link'
import { ButtonLink } from '@/app/components/ui/button'
import { ArrowRightIcon, CheckCircleIcon, CircleIcon } from '@/app/components/ui/icons'

export const CHECKLIST_DESTINATIONS = {
  codebook: 'Codebook',
  prompt: 'Prompt',
  items: 'Itens',
  rounds: 'Rodadas',
} as const

export type ChecklistDestination = keyof typeof CHECKLIST_DESTINATIONS

type PendingStep = {
  key: string
  status: 'pending'
  action: string
  why: string
  href: string
  destination: ChecklistDestination
}

export type ChecklistStep =
  | { key: string; status: 'done'; title: string }
  | { key: string; status: 'waiting'; title: string; note: string; help: string }
  | PendingStep

export function PhaseChecklist({
  title,
  badge,
  steps,
  active,
  className,
  children,
}: {
  title: string
  badge?: React.ReactNode
  steps: readonly ChecklistStep[]
  active: boolean
  className?: string
  children: React.ReactNode
}) {
  const next = active
    ? steps.find((step): step is PendingStep => step.status === 'pending')
    : undefined

  return (
    <div className={className}>
      {next ? <NextStep step={next} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-[13px] font-semibold text-ink">{title}</h3>
        {badge}
      </div>

      <ul className="m-0 mt-2 flex list-none flex-wrap items-start gap-x-2 gap-y-1.5 p-0">
        {steps.map((step, index) => (
          <ChecklistItem
            key={step.key}
            step={step}
            current={step === next}
            separated={index > 0}
          />
        ))}
      </ul>

      {children}
    </div>
  )
}

function NextStep({ step }: { step: PendingStep }) {
  return (
    <div className="mb-5">
      <span className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
        Próximo passo
      </span>
      <p className="m-0 mt-1 text-[15px] font-bold text-ink">{step.action}</p>
      <p className="m-0 mt-1 text-[13px] leading-[1.6] text-muted">{step.why}</p>
      <ButtonLink href={step.href} className="mt-3">
        {`Ir para ${CHECKLIST_DESTINATIONS[step.destination]}`}
        <ArrowRightIcon />
      </ButtonLink>
    </div>
  )
}

function ChecklistItem({
  step,
  current,
  separated,
}: {
  step: ChecklistStep
  current: boolean
  separated: boolean
}) {
  return (
    <li
      aria-current={current ? 'step' : undefined}
      title={step.status === 'waiting' ? step.help : undefined}
      className="flex max-w-full min-w-0 items-start gap-1.5 text-[13px]"
    >
      {separated ? (
        <span aria-hidden="true" className="text-faint">
          ·
        </span>
      ) : null}

      {step.status === 'done' ? (
        <CheckCircleIcon className="mt-0.5 text-success-fg" />
      ) : (
        <CircleIcon className={current ? 'mt-0.5 text-brand' : 'mt-0.5 text-faint'} />
      )}

      {step.status === 'done' ? (
        <span className="text-muted">
          {step.title}
          <span className="sr-only"> pronto</span>
        </span>
      ) : step.status === 'waiting' ? (
        <span className="text-muted">{`${step.title} (${step.note})`}</span>
      ) : current ? (
        <span className="font-semibold text-ink">{step.action}</span>
      ) : (
        <Link
          href={step.href}
          className="font-semibold text-brand transition-colors hover:text-brand-hover"
        >
          {step.action}
        </Link>
      )}
    </li>
  )
}
