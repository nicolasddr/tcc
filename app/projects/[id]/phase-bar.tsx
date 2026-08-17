import { Card } from '@/app/components/ui/card'
import { cx } from '@/app/components/ui/cx'

export const PROJECT_PHASES = [
  { name: 'Configuração inicial', short: 'Configuração' },
  { name: 'Validação do codebook', short: 'Codebook' },
  { name: 'Validação do prompt', short: 'Prompt' },
  { name: 'Validação final', short: 'Final' },
] as const

export const TOTAL_PHASES = PROJECT_PHASES.length

export function PhaseBar({
  current,
  badge,
  action,
  className,
}: {
  current: number
  badge?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  const phase = PROJECT_PHASES[current - 1]

  return (
    <Card
      padding="lg"
      tone="subtle"
      className={cx(
        'flex flex-wrap items-center justify-between gap-x-6 gap-y-4',
        className,
      )}
    >
      <div className="min-w-[260px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
            Fase {current} de {TOTAL_PHASES}
          </span>
          {badge}
        </div>

        <h2 className="mt-1 text-[15px] font-bold text-ink">{phase?.name}</h2>

        <ol className="mt-3 flex items-center gap-2">
          {PROJECT_PHASES.map((p, i) => {
            const step = i + 1
            const reached = step <= current
            const isCurrent = step === current

            return (
              <li
                key={p.short}
                aria-current={isCurrent ? 'step' : undefined}
                className="flex min-w-0 flex-1 flex-col gap-1.5"
              >
                <span
                  className={cx(
                    'h-1.5 rounded-full',
                    reached ? 'bg-brand' : 'bg-line',
                  )}
                />
                <span
                  className={cx(
                    'truncate text-[11px] font-semibold',
                    isCurrent ? 'text-ink' : reached ? 'text-muted' : 'text-faint',
                  )}
                >
                  {step}
                  <span className="hidden sm:inline">. {p.short}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
    </Card>
  )
}
