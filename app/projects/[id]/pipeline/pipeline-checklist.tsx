import { Badge } from '@/app/components/ui/badge'
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
import { ChecklistItem, PhaseChecklist } from './checklist'

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
    <PhaseChecklist
      className={className}
      title="Para avançar para a Fase 2"
      badge={
        phase !== PHASE_1 ? (
          <Badge tone="success">Fase 1 concluída</Badge>
        ) : pending.length === 0 ? (
          <Badge tone="success">tudo pronto</Badge>
        ) : (
          <Badge tone="warning">
            {pending.length === 1 ? 'falta 1' : `faltam ${pending.length}`}
          </Badge>
        )
      }
      items={PIPELINE_REQUIREMENTS.map((req) =>
        pendingKeys.has(req.key) ? (
          <ChecklistItem
            key={req.key}
            status="pending"
            label={req.action}
            help={req.pending}
            href={`/projects/${projectId}/${req.route}`}
            destination={req.route}
          />
        ) : (
          <ChecklistItem key={req.key} status="done" label={req.title} />
        ),
      )}
    >
      {phase === PHASE_1 ? (
        <AdvancePhase
          projectId={projectId}
          target={PHASE_2}
          blocked={pending.length > 0}
          hint={hint}
          lines={phase2ConfirmationLines()}
        />
      ) : (
        <p className="m-0 mt-3 text-[13px] text-muted">
          A Fase 1 já foi concluída: o projeto está na Fase {phase}. O que foi
          configurado continua aqui para consulta.
        </p>
      )}
    </PhaseChecklist>
  )
}
