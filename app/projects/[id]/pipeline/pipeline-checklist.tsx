import { Badge } from '@/app/components/ui/badge'
import {
  PHASE_1,
  PHASE_2,
  PIPELINE_REQUIREMENTS,
  pendingRequirements,
  phase2ConfirmationLines,
  type PipelineInputs,
} from './preconditions'
import { AdvancePhase } from './advance-phase'
import { PhaseChecklist } from './checklist'

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

  return (
    <PhaseChecklist
      className={className}
      title="Para avançar para a Fase 2"
      badge={phase !== PHASE_1 ? <Badge tone="success">Fase 1 concluída</Badge> : null}
      active={phase === PHASE_1}
      steps={PIPELINE_REQUIREMENTS.map((req) =>
        pendingKeys.has(req.key)
          ? {
              key: req.key,
              status: 'pending' as const,
              action: req.action,
              why: req.pending,
              href: `/projects/${projectId}/${req.route}`,
              destination: req.route,
            }
          : { key: req.key, status: 'done' as const, title: req.title },
      )}
    >
      {phase !== PHASE_1 ? (
        <p className="m-0 mt-3 text-[13px] text-muted">
          A Fase 1 já foi concluída: o projeto está na Fase {phase}. O que foi
          configurado continua aqui para consulta.
        </p>
      ) : pending.length === 0 ? (
        <AdvancePhase
          projectId={projectId}
          target={PHASE_2}
          hint="A configuração está completa. O avanço pede confirmação antes de mudar qualquer coisa."
          lines={phase2ConfirmationLines()}
        />
      ) : null}
    </PhaseChecklist>
  )
}
