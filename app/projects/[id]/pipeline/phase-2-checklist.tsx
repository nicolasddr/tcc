import { Badge } from '@/app/components/ui/badge'
import {
  PHASE_2,
  PHASE_3,
  phase2BlockerMessage,
  phase2Blockers,
  phase3ConfirmationLines,
  type Phase2Blocker,
  type Phase2Inputs,
} from './preconditions'
import { AdvancePhase } from './advance-phase'
import { PhaseChecklist, type ChecklistStep } from './checklist'
import { LastRoundSummary, type LastClosedRound } from './last-round-summary'

type Phase2Requirement = { key: Phase2Blocker['key']; title: string }

const PHASE_2_REQUIREMENTS: readonly Phase2Requirement[] = [
  { key: 'open_round', title: 'Nenhuma rodada aberta' },
  { key: 'no_closed_round', title: 'Ao menos uma rodada fechada' },
] as const

function phase2BlockerAction(blocker: Phase2Blocker): string {
  switch (blocker.key) {
    case 'open_round':
      return `Fechar a rodada ${blocker.roundNumber}`
    case 'no_closed_round':
      return 'Fechar ao menos uma rodada'
  }
}

export function Phase2Checklist({
  projectId,
  phase,
  inputs,
  lastRound,
  className,
}: {
  projectId: string
  phase: number
  inputs: Phase2Inputs
  lastRound: LastClosedRound | null
  className?: string
}) {
  const blockers = phase2Blockers(inputs)
  const byKey = new Map(blockers.map((blocker) => [blocker.key, blocker]))

  return (
    <PhaseChecklist
      className={className}
      title={`Para avançar para a Fase ${PHASE_3}`}
      badge={
        phase !== PHASE_2 ? <Badge tone="success">Fase {PHASE_2} concluída</Badge> : null
      }
      active={phase === PHASE_2}
      steps={PHASE_2_REQUIREMENTS.map((req): ChecklistStep => {
        const blocker = byKey.get(req.key)

        return blocker
          ? {
              key: req.key,
              status: 'pending',
              action: phase2BlockerAction(blocker),
              why: phase2BlockerMessage(blocker),
              href: `/projects/${projectId}/rounds`,
              destination: 'rounds',
            }
          : { key: req.key, status: 'done', title: req.title }
      })}
    >
      {phase === PHASE_2 ? (
        blockers.length === 0 ? (
          <AdvancePhase
            projectId={projectId}
            target={PHASE_3}
            hint="Tudo pronto. O avanço pede confirmação antes de mudar qualquer coisa."
            lines={phase3ConfirmationLines()}
            summary={lastRound ? <LastRoundSummary round={lastRound} /> : null}
          />
        ) : null
      ) : (
        <p className="m-0 mt-3 text-[13px] text-muted">
          A Fase {PHASE_2} já foi concluída: o projeto está na Fase {phase}. As rodadas,
          as avaliações, a concordância e a confiabilidade continuam aqui para consulta.
        </p>
      )}
    </PhaseChecklist>
  )
}
