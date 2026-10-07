import Link from '@/app/components/app-link'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Panel } from '@/app/components/ui/panel'
import { CheckCircleIcon, CircleIcon } from '@/app/components/ui/icons'
import {
  PHASE_3,
  returnBlockerMessage,
  returnBlockers,
  returnConfirmationLines,
  type ReturnInputs,
} from './preconditions'
import { ReturnPhase } from './return-phase'

export function Phase4Return({
  projectId,
  inputs,
  summary,
  className,
}: {
  projectId: string
  inputs: ReturnInputs
  summary?: React.ReactNode
  className?: string
}) {
  const [blocker] = returnBlockers(inputs)
  const hint = blocker
    ? 'Falta 1 pendência para liberar o retorno.'
    : 'Nenhuma rodada aberta. O retorno pede confirmação antes de mudar qualquer coisa.'

  return (
    <Panel
      className={className}
      title={`Para voltar à Fase ${PHASE_3}`}
      icon={<CheckCircleIcon />}
      action={
        blocker ? (
          <Badge tone="warning">1 pendência</Badge>
        ) : (
          <Badge tone="neutral">liberado</Badge>
        )
      }
    >
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <li>
          <Card
            padding="sm"
            tone={blocker ? 'default' : 'subtle'}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
          >
            <div className="flex min-w-[240px] flex-1 items-start gap-2.5">
              {blocker ? (
                <CircleIcon className="mt-0.5 text-faint" />
              ) : (
                <CheckCircleIcon className="mt-0.5 text-success-fg" />
              )}
              <div className="min-w-0">
                <p className="m-0 text-[13px] font-semibold text-ink">Nenhuma rodada aberta</p>
                {blocker ? (
                  <p className="m-0 mt-0.5 text-[13px] text-muted">
                    {returnBlockerMessage(blocker)}
                  </p>
                ) : null}
              </div>
            </div>

            {blocker ? (
              <Link
                href={`/projects/${projectId}/rounds`}
                className="text-[13px] font-semibold text-brand transition-colors hover:text-brand-hover"
              >
                Resolver
              </Link>
            ) : (
              <Badge tone="success">pronto</Badge>
            )}
          </Card>
        </li>
      </ul>

      <ReturnPhase
        projectId={projectId}
        blocked={blocker !== undefined}
        hint={hint}
        lines={returnConfirmationLines()}
        summary={summary}
      />
    </Panel>
  )
}
