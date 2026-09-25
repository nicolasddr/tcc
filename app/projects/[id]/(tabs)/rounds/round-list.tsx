import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { OpenLink } from '@/app/components/ui/open-link'
import { formatDate } from '@/app/notifications/labels'
import { AgreementValue } from './agreement-panel'
import type { AgreementPair } from './agreement-pair'
import { QualityValue } from './quality-panel'
import type { QualityPair } from './quality'
import { isOpen, type RoundSummary } from './rounds'
import { previousRoundOf, roundChanges } from './round-changes'
import { RoundChangesNote } from './round-changes-note'

function changesOf(rounds: readonly RoundSummary[], round: RoundSummary) {
  const changes = roundChanges(round, previousRoundOf(rounds, round))
  if (!changes) return null

  return (
    <div className="mt-2">
      <RoundChangesNote changes={changes} compact />
    </div>
  )
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
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {rounds.map((round) => (
        <li key={round.id}>
          <Card>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm font-semibold text-ink">
                Rodada {round.roundNumber}
                <span className="font-normal text-muted"> · Fase {round.phase}</span>
              </span>
              {isOpen(round) ? (
                <Badge tone="info">aberta</Badge>
              ) : (
                <Badge tone="neutral">fechada</Badge>
              )}
            </div>

            <p className="m-0 mt-1.5 text-[13px] text-muted">
              Codebook v{round.codebookVersionNumber} · Prompt v
              {round.promptVersionNumber}
            </p>

            <p className="m-0 mt-1.5 text-[13px] text-muted">
              Aberta em {formatDate(round.createdAt)} por {round.authorName}
              {round.closedAt ? ` · fechada em ${formatDate(round.closedAt)}` : null}
            </p>

            {changesOf(rounds, round)}

            {agreement.has(round.id) ? (
              <AgreementValue pair={agreement.get(round.id)!} />
            ) : null}

            {quality.has(round.id) ? <QualityValue pair={quality.get(round.id)!} /> : null}

            {isOpen(round) ? null : (
              <p className="m-0 mt-2 text-[13px]">
                <OpenLink href={`/projects/${projectId}/rounds/${round.id}`}>
                  Abrir revisão
                </OpenLink>
              </p>
            )}
          </Card>
        </li>
      ))}
    </ul>
  )
}
