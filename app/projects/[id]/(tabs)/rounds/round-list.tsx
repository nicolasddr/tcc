import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { formatDate } from '@/app/notifications/labels'
import { isOpen, type RoundSummary } from './rounds'

export function RoundList({ rounds }: { rounds: RoundSummary[] }) {
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
          </Card>
        </li>
      ))}
    </ul>
  )
}
