import Link from '@/app/components/app-link'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Panel } from '@/app/components/ui/panel'
import { CheckCircleIcon, CircleIcon } from '@/app/components/ui/icons'
import { formatDate } from '@/app/notifications/labels'
import type { AgreementPair } from '../(tabs)/rounds/agreement-pair'
import { AgreementValue } from '../(tabs)/rounds/agreement-panel'
import {
  BAND_REFERENCE,
  notCalculableMessage,
} from '../(tabs)/rounds/agreement-labels'
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

export type LastClosedRound = {
  roundNumber: number
  closedAt: string | null
  pair: AgreementPair
}

type Phase2Requirement = { key: Phase2Blocker['key']; title: string }

const PHASE_2_REQUIREMENTS: readonly Phase2Requirement[] = [
  { key: 'open_round', title: 'Nenhuma rodada aberta' },
  { key: 'no_closed_round', title: 'Ao menos uma rodada fechada' },
] as const

function LastRoundSummary({ round }: { round: LastClosedRound }) {
  const { all } = round.pair

  return (
    <Card tone="subtle" padding="sm">
      <span className="text-[13px] font-semibold text-ink">
        Última rodada fechada: rodada {round.roundNumber}
        {round.closedAt ? ` · fechada em ${formatDate(round.closedAt)}` : null}
      </span>
      <AgreementValue pair={round.pair} />
      <p className="m-0 mt-1.5 text-xs text-muted">
        {all.calculable ? BAND_REFERENCE : notCalculableMessage(all.reason)}
      </p>
    </Card>
  )
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
  const hint =
    blockers.length > 0
      ? `${blockers.length === 1 ? 'Falta 1 pendência' : `Faltam ${blockers.length} pendências`} para liberar o avanço.`
      : 'Nenhuma rodada aberta e ao menos uma fechada. O avanço pede confirmação ' +
        'antes de mudar qualquer coisa.'

  return (
    <Panel
      className={className}
      title={`Para avançar para a Fase ${PHASE_3}`}
      icon={<CheckCircleIcon />}
      action={
        phase !== PHASE_2 ? (
          <Badge tone="success">Fase {PHASE_2} concluída</Badge>
        ) : blockers.length === 0 ? (
          <Badge tone="success">tudo pronto</Badge>
        ) : (
          <Badge tone="warning">
            {blockers.length} de {PHASE_2_REQUIREMENTS.length} pendentes
          </Badge>
        )
      }
    >
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {PHASE_2_REQUIREMENTS.map((req) => {
          const blocker = byKey.get(req.key)

          return (
            <li key={req.key}>
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
                    <p className="m-0 text-[13px] font-semibold text-ink">{req.title}</p>
                    {blocker ? (
                      <p className="m-0 mt-0.5 text-[13px] text-muted">
                        {phase2BlockerMessage(blocker)}
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
          )
        })}
      </ul>

      {phase === PHASE_2 ? (
        <AdvancePhase
          projectId={projectId}
          target={PHASE_3}
          blocked={blockers.length > 0}
          hint={hint}
          lines={phase3ConfirmationLines()}
          summary={lastRound ? <LastRoundSummary round={lastRound} /> : null}
        />
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
          A Fase {PHASE_2} já foi concluída: o projeto está na Fase {phase}. As rodadas,
          as avaliações e a concordância continuam aqui para consulta.
        </p>
      )}
    </Panel>
  )
}
