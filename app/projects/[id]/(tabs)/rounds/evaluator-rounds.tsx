import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { OpenLink } from '@/app/components/ui/open-link'
import { formatDate } from '@/app/notifications/labels'
import type { ReviewableRound } from './review'

export function EvaluatorRounds({
  projectId,
  rounds,
}: {
  projectId: string
  rounds: ReviewableRound[]
}) {
  if (rounds.length === 0) {
    return (
      <EmptyState>
        Nenhuma rodada para revisar ainda. A revisão de uma rodada aparece aqui depois
        que ela fecha, e só das rodadas em que você enviou avaliação.
      </EmptyState>
    )
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {rounds.map((round) => (
        <li key={round.id}>
          <Card>
            <span className="text-sm font-semibold text-ink">
              Rodada {round.roundNumber}
            </span>

            <p className="m-0 mt-1.5 text-[13px] text-muted">
              Fechada em {formatDate(round.closedAt)}
            </p>

            <p className="m-0 mt-2 text-[13px]">
              <OpenLink href={`/projects/${projectId}/rounds/${round.id}`}>
                Abrir revisão
              </OpenLink>
            </p>
          </Card>
        </li>
      ))}
    </ul>
  )
}
