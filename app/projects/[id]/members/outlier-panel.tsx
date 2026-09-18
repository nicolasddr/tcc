import type { EvaluatorEffort } from '../(tabs)/rounds/agreement'
import type { OutlierMark } from '../(tabs)/rounds/outliers'
import type { EvaluatedRound } from '../(tabs)/rounds/rounds'
import { MarkOutlierForm, UnmarkOutlierForm } from './outlier-forms'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { Chip, ChipLink } from '@/app/components/ui/chip'
import { cx } from '@/app/components/ui/cx'
import { Disclosure } from '@/app/components/ui/disclosure'
import { EmptyState } from '@/app/components/ui/empty-state'
import { preWrapClass, scrollBoxClass } from '@/app/components/ui/prose'
import { formatDate } from '@/app/notifications/labels'

export type OutlierPanelData = {
  rounds: EvaluatedRound[]
  round: EvaluatedRound | null
  effort: EvaluatorEffort[]
  marks: OutlierMark[]
  history: OutlierMark[]
}

const reasonClass =
  'm-0 mt-1.5 rounded-card border border-line bg-surface-subtle px-3 py-2 ' +
  'text-[13px] text-ink'

function submittedLabel(submitted: number): string {
  return submitted === 1 ? '1 avaliação enviada' : `${submitted} avaliações enviadas`
}

function Reason({ reason }: { reason: string }) {
  return (
    <p className={cx(reasonClass, scrollBoxClass, preWrapClass)}>{reason}</p>
  )
}

function Evaluator({
  projectId,
  round,
  evaluator,
  mark,
}: {
  projectId: string
  round: EvaluatedRound
  evaluator: EvaluatorEffort
  mark: OutlierMark | undefined
}) {
  return (
    <li>
      <Card padding="sm" tone={mark ? 'accent' : 'default'}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold text-ink">{evaluator.name}</span>
          {mark ? <Badge tone="warning">outlier</Badge> : null}
          <span className="text-[12.5px] text-muted">
            {submittedLabel(evaluator.submitted)}
          </span>
        </div>

        {mark ? (
          <div className="mt-2 flex flex-col gap-2">
            <div>
              <span className="text-[12.5px] text-muted">
                Marcado por {mark.markedByName} em {formatDate(mark.markedAt)}
              </span>
              <Reason reason={mark.reason} />
            </div>

            <UnmarkOutlierForm
              projectId={projectId}
              roundId={round.id}
              markId={mark.id}
              evaluatorName={evaluator.name}
              roundNumber={round.roundNumber}
            />
          </div>
        ) : (
          <Disclosure summary="Marcar como outlier">
            <MarkOutlierForm
              projectId={projectId}
              roundId={round.id}
              projectMemberId={evaluator.projectMemberId}
              evaluatorName={evaluator.name}
              roundNumber={round.roundNumber}
            />
          </Disclosure>
        )}
      </Card>
    </li>
  )
}

function HistoryEntry({ mark }: { mark: OutlierMark }) {
  return (
    <li>
      <Card padding="sm" tone="subtle">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold text-ink">
            {mark.evaluatorName}
          </span>
          <Badge tone={mark.removedAt ? 'neutral' : 'warning'}>
            {mark.removedAt ? 'marca removida' : 'marca ativa'}
          </Badge>
        </div>

        <p className="m-0 mt-1 text-[12.5px] text-muted">
          Marcado por {mark.markedByName} em {formatDate(mark.markedAt)}
          {mark.removedAt
            ? ` · removido por ${mark.removedByName} em ${formatDate(mark.removedAt)}`
            : null}
        </p>

        <Reason reason={mark.reason} />
      </Card>
    </li>
  )
}

export function OutlierPanel({
  projectId,
  rounds,
  round,
  effort,
  marks,
  history,
}: { projectId: string } & OutlierPanelData) {
  if (!round) {
    return (
      <EmptyState>
        Nenhuma rodada deste projeto recebeu avaliação ainda. A marca de outlier tira do
        cálculo as notas de uma pessoa em uma rodada, então ela só existe onde já há nota
        para tirar.
      </EmptyState>
    )
  }

  const evaluators = effort.filter((evaluator) => evaluator.submitted > 0)
  const byMember = new Map(marks.map((mark) => [mark.projectMemberId, mark]))

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Rodada em foco" className="flex flex-wrap gap-2">
        {rounds.map((option) =>
          option.id === round.id ? (
            <Chip key={option.id} className="border-brand-border font-semibold text-ink">
              Rodada {option.roundNumber}
            </Chip>
          ) : (
            <ChipLink
              key={option.id}
              href={`/projects/${projectId}/members?round=${option.id}`}
            >
              Rodada {option.roundNumber}
            </ChipLink>
          ),
        )}
      </nav>

      {evaluators.length === 0 ? (
        <EmptyState>
          Nenhum avaliador ativo enviou avaliação na rodada {round.roundNumber}.
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {evaluators.map((evaluator) => (
            <Evaluator
              key={evaluator.projectMemberId}
              projectId={projectId}
              round={round}
              evaluator={evaluator}
              mark={byMember.get(evaluator.projectMemberId)}
            />
          ))}
        </ul>
      )}

      <Disclosure
        summary={`Histórico de marcações da rodada ${round.roundNumber} (${history.length})`}
      >
        {history.length === 0 ? (
          <p className="m-0 mt-2 text-[13px] text-muted">
            Ninguém foi marcado como outlier nesta rodada até agora.
          </p>
        ) : (
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {history.map((mark) => (
              <HistoryEntry key={mark.id} mark={mark} />
            ))}
          </ul>
        )}
      </Disclosure>
    </div>
  )
}
