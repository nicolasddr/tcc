import Link from '@/app/components/app-link'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Panel } from '@/app/components/ui/panel'
import { CheckCircleIcon, CircleIcon } from '@/app/components/ui/icons'
import {
  PHASE_1,
  PHASE_2,
  PIPELINE_REQUIREMENTS,
  missingInputsList,
  pendingRequirements,
  phase2ConfirmationLines,
  type PipelineInputs,
} from './preconditions'
import { AdvancePhase } from './advance-phase'

export function PipelineChecklist({
  projectId,
  phase,
  inputs,
  className,
}: {
  projectId: string
  phase: number
  inputs: PipelineInputs
  className?: string
}) {
  const pending = pendingRequirements(inputs)
  const pendingKeys = new Set(pending.map((r) => r.key))
  const hint =
    pending.length > 0
      ? `${pending.length === 1 ? 'Falta' : 'Faltam'} ${missingInputsList(pending)} ` +
        'para liberar o avanço.'
      : 'A configuração está completa. O avanço pede confirmação antes de mudar ' +
        'qualquer coisa.'

  return (
    <Panel
      className={className}
      title="Para avançar para a Fase 2"
      icon={<CheckCircleIcon />}
      action={
        phase !== PHASE_1 ? (
          <Badge tone="success">Fase 1 concluída</Badge>
        ) : pending.length === 0 ? (
          <Badge tone="success">tudo pronto</Badge>
        ) : (
          <Badge tone="warning">
            {pending.length} de {PIPELINE_REQUIREMENTS.length} pendentes
          </Badge>
        )
      }
    >
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {PIPELINE_REQUIREMENTS.map((req) => {
          const done = !pendingKeys.has(req.key)

          return (
            <li key={req.key}>
              <Card
                padding="sm"
                tone={done ? 'subtle' : 'default'}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
              >
                <div className="flex min-w-[240px] flex-1 items-start gap-2.5">
                  {done ? (
                    <CheckCircleIcon className="mt-0.5 text-success-fg" />
                  ) : (
                    <CircleIcon className="mt-0.5 text-faint" />
                  )}
                  <div className="min-w-0">
                    <p className="m-0 text-[13px] font-semibold text-ink">{req.title}</p>
                    {done ? null : (
                      <p className="m-0 mt-0.5 text-[13px] text-muted">{req.pending}</p>
                    )}
                  </div>
                </div>

                {done ? (
                  <Badge tone="success">pronto</Badge>
                ) : (
                  <Link
                    href={`/projects/${projectId}/${req.route}`}
                    className="text-[13px] font-semibold text-brand transition-colors hover:text-brand-hover"
                  >
                    Resolver
                  </Link>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      {phase === PHASE_1 ? (
        <AdvancePhase
          projectId={projectId}
          target={PHASE_2}
          blocked={pending.length > 0}
          hint={hint}
          lines={phase2ConfirmationLines()}
        />
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
          A Fase 1 já foi concluída: o projeto está na Fase {phase}. O que foi
          configurado continua aqui para consulta.
        </p>
      )}
    </Panel>
  )
}
