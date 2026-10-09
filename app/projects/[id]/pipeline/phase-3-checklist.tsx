import { Badge } from '@/app/components/ui/badge'
import {
  PHASE_3,
  PHASE_4,
  phase3BlockerMessage,
  phase3Blockers,
  phase4ConfirmationLines,
  type Phase3Blocker,
  type Phase3Inputs,
} from './preconditions'
import { AdvancePhase } from './advance-phase'
import { ChecklistItem, PhaseChecklist } from './checklist'
import { LastRoundSummary, type LastClosedRound } from './last-round-summary'

type Phase3Requirement = { key: Phase3Blocker['key']; title: string }

const PHASE_3_REQUIREMENTS: readonly Phase3Requirement[] = [
  { key: 'open_round', title: 'Nenhuma rodada aberta' },
  { key: 'no_closed_round', title: `Ao menos uma rodada fechada na Fase ${PHASE_3}` },
  { key: 'versions_changed', title: 'Codebook e prompt iguais aos da rodada de referência' },
] as const

function phase3BlockerAction(blocker: Phase3Blocker): string {
  switch (blocker.key) {
    case 'open_round':
      return `Fechar a rodada ${blocker.roundNumber}`
    case 'no_closed_round':
      return `Fechar ao menos uma rodada da Fase ${PHASE_3}`
    case 'versions_changed':
      return `Abrir e fechar mais uma rodada da Fase ${PHASE_3} com as versões vigentes`
  }
}

const NO_REFERENCE_ROUND =
  `Depende da rodada de referência, a última rodada fechada da Fase ${PHASE_3}, que ainda ` +
  'não existe.'

export function Phase3Checklist({
  projectId,
  phase,
  inputs,
  lastRound,
  className,
}: {
  projectId: string
  phase: number
  inputs: Phase3Inputs
  lastRound: LastClosedRound | null
  className?: string
}) {
  const blockers = phase3Blockers(inputs)
  const byKey = new Map(blockers.map((blocker) => [blocker.key, blocker]))
  const hint =
    blockers.length > 0
      ? `${blockers.length === 1 ? 'Falta 1 pendência' : `Faltam ${blockers.length} pendências`} para liberar o avanço.`
      : 'Tudo pronto. O avanço pede confirmação antes de mudar qualquer coisa.'

  return (
    <PhaseChecklist
      className={className}
      title={`Para avançar para a Fase ${PHASE_4}`}
      badge={
        phase !== PHASE_3 ? (
          <Badge tone="success">Fase {PHASE_3} concluída</Badge>
        ) : blockers.length === 0 ? (
          <Badge tone="success">tudo pronto</Badge>
        ) : (
          <Badge tone="warning">
            {blockers.length === 1 ? 'falta 1' : `faltam ${blockers.length}`}
          </Badge>
        )
      }
      items={PHASE_3_REQUIREMENTS.map((req) => {
        const blocker = byKey.get(req.key)

        if (blocker) {
          return (
            <ChecklistItem
              key={req.key}
              status="pending"
              label={phase3BlockerAction(blocker)}
              help={phase3BlockerMessage(blocker)}
              href={`/projects/${projectId}/rounds`}
              destination="rounds"
            />
          )
        }

        return req.key === 'versions_changed' && inputs.versions === null ? (
          <ChecklistItem
            key={req.key}
            status="waiting"
            label={req.title}
            help={NO_REFERENCE_ROUND}
          />
        ) : (
          <ChecklistItem key={req.key} status="done" label={req.title} />
        )
      })}
    >
      {phase === PHASE_3 ? (
        <AdvancePhase
          projectId={projectId}
          target={PHASE_4}
          blocked={blockers.length > 0}
          hint={hint}
          lines={phase4ConfirmationLines()}
          summary={
            lastRound ? (
              <LastRoundSummary round={lastRound} reference={inputs.versions?.reference} />
            ) : null
          }
        />
      ) : (
        <p className="m-0 mt-3 text-[13px] text-muted">
          A Fase {PHASE_3} já foi concluída: o projeto está na Fase {phase}. As rodadas,
          as avaliações, a concordância e a Qualidade da Fase {PHASE_3} continuam aqui
          para consulta.
        </p>
      )}
    </PhaseChecklist>
  )
}
