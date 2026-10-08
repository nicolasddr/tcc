import { Badge } from '@/app/components/ui/badge'
import { ButtonLink } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { formatDate } from '@/app/notifications/labels'
import { AgreementValue } from './agreement-panel'
import type { AgreementPair } from './agreement-pair'
import { phaseRuns } from './agreement-series'
import { QualitySummary } from './quality-panel'
import type { QualityPair } from './quality'
import { isOpen, type RoundSummary } from './rounds'
import { previousRoundOf, roundChanges } from './round-changes'
import { RoundChangeChips } from './round-changes-note'
import { referenceComparison } from './reference-comparison'
import { closedOn } from './reference-comparison-labels'
import { ReferenceRoundLine } from './reference-comparison-panel'

function openedText(round: RoundSummary): string {
  const opened = `Aberta em ${formatDate(round.createdAt)} por ${round.authorName}`
  return round.closedAt ? `${opened} · ${closedOn(round.closedAt)}` : opened
}

function referenceOf(
  rounds: readonly RoundSummary[],
  round: RoundSummary,
  agreement: Map<string, AgreementPair>,
  quality: Map<string, QualityPair>,
) {
  const comparison = referenceComparison(rounds, round, agreement, quality)
  if (comparison.kind !== 'compared') return null

  return <ReferenceRoundLine reference={comparison.reference} />
}

export function RoundList({
  projectId,
  rounds,
  agreement,
  quality,
}: {
  projectId: string
  rounds: RoundSummary[]
  agreement: Map<string, AgreementPair>
  quality: Map<string, QualityPair>
}) {
  if (rounds.length === 0) {
    return (
      <EmptyState>
        Nenhuma rodada ainda. A primeira rodada congela a versão vigente do codebook e a
        do prompt, e é a partir dela que o projeto passa a produzir dado de pesquisa.
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {phaseRuns(rounds).map((run) => (
        <section key={run.points[0].id} className="flex flex-col gap-2">
          <h3 className="m-0 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
            Fase {run.phase}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {run.points.map((round) => (
              <li key={round.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">
                        Rodada {round.roundNumber}
                      </span>
                      {isOpen(round) ? (
                        <Badge tone="info">aberta</Badge>
                      ) : (
                        <Badge tone="neutral">fechada</Badge>
                      )}
                      <InfoTooltip text={openedText(round)} />
                    </span>
                    {isOpen(round) ? null : (
                      <ButtonLink
                        href={`/projects/${projectId}/rounds/${round.id}`}
                        variant="secondary"
                        size="sm"
                      >
                        Abrir revisão
                      </ButtonLink>
                    )}
                  </div>

                  <div className="mt-2">
                    <RoundChangeChips
                      round={round}
                      changes={roundChanges(round, previousRoundOf(rounds, round))}
                    />
                  </div>

                  {agreement.has(round.id) ? (
                    <AgreementValue pair={agreement.get(round.id)!} />
                  ) : null}

                  {quality.has(round.id) ? (
                    <QualitySummary pair={quality.get(round.id)!} />
                  ) : null}

                  {referenceOf(rounds, round, agreement, quality)}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
