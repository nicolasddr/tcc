import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import {
  loadCodebook,
  loadCodebookVersion,
  type CodebookCriterion,
  type CodebookDefinition,
} from '../../pipeline/codebook'
import { resolveCells, type CodebookCell } from '../../pipeline/criteria'
import {
  listRoundResponses,
  loadRoundResponse,
  type ResponseDetail,
} from '../../pipeline/responses'
import { loadOpenRound } from '../rounds/rounds'
import { requireEvaluator } from './access'
import {
  loadEvaluatedResponseIds,
  loadEvaluationOf,
  type SubmittedEvaluation,
} from './evaluation'
import { buildQueue, pickResponseId } from './queue'
import { progressMessage, type Progress } from './progress'
import { waitingMessage, waitingState, type WaitingState } from './waiting'
import { EvaluationForm } from './evaluation-form'
import { ButtonLink } from '@/app/components/ui/button'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Section } from '@/app/components/ui/section'
import { ProgressBar } from '@/app/components/ui/stat'

type EvaluateView = {
  waiting: WaitingState | null
  roundNumber: number | null
  response: ResponseDetail | null
  label: string
  cells: CodebookCell<CodebookDefinition, CodebookCriterion>[]
  submitted: SubmittedEvaluation | null
  progress: Progress
  nextId: string | null
}

const empty: Omit<EvaluateView, 'waiting' | 'roundNumber'> = {
  response: null,
  label: '',
  cells: [],
  submitted: null,
  progress: { evaluated: 0, total: 0 },
  nextId: null,
}

export default async function ProjectEvaluatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ response?: string }>
}) {
  const { id } = await params
  const requested = (await searchParams).response ?? null
  const userId = await requireUserId()

  const { waiting, roundNumber, response, label, cells, submitted, progress, nextId } =
    await transaction<EvaluateView>(async (tx) => {
      const { project, memberId } = await requireEvaluator(id, userId, tx)

      const round = await loadOpenRound(id, tx)

      if (!round) {
        const codebook = await loadCodebook(id, tx)

        return {
          waiting: waitingState({
            phase: project.phase,
            definitions: codebook.definitions,
            criteria: codebook.criteria,
            openRound: null,
            total: 0,
            evaluated: 0,
          }),
          roundNumber: null,
          ...empty,
        }
      }

      const listed = await listRoundResponses(round.id, tx)
      const evaluated = await loadEvaluatedResponseIds(round.id, memberId, tx)
      const queue = buildQueue(listed, evaluated, memberId, round.id)
      const codebook = await loadCodebookVersion(id, round.codebookVersionId, tx)

      const waiting = waitingState({
        phase: project.phase,
        definitions: codebook?.definitions ?? [],
        criteria: codebook?.criteria ?? [],
        openRound: round,
        total: queue.length,
        evaluated: evaluated.length,
      })
      const progress = { evaluated: evaluated.length, total: queue.length }

      const currentId = pickResponseId(queue, requested)
      if (!currentId) {
        return { waiting, roundNumber: round.roundNumber, ...empty, progress }
      }

      if (currentId !== requested) {
        redirect(`/projects/${id}/evaluate?response=${currentId}`)
      }

      const current = queue.find((response) => response.id === currentId)!

      return {
        waiting,
        roundNumber: round.roundNumber,
        response: await loadRoundResponse(round.id, currentId, tx),
        label: current.label,
        cells: codebook ? resolveCells(codebook.definitions, codebook.criteria) : [],
        submitted: await loadEvaluationOf(currentId, memberId, tx),
        progress,
        nextId:
          queue.find((response) => !response.evaluated && response.id !== currentId)
            ?.id ?? null,
      }
    })

  const held = waiting && waiting.key !== 'finished' ? waiting : null

  return (
    <Section
      title={roundNumber ? `Avaliar na rodada ${roundNumber}` : 'Avaliar respostas'}
      hint="Cada resposta é avaliada uma vez, em cada critério de cada definição do codebook que esta rodada fixou. O envio é definitivo."
    >
      {held ? (
        <EmptyState>{waitingMessage(held)}</EmptyState>
      ) : !response || cells.length === 0 ? (
        <EmptyState>{waitingMessage({ key: 'codebook' })}</EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[13px] font-semibold text-ink">{label}</span>
              <span className="text-[13px] text-muted">{progressMessage(progress)}</span>
            </div>

            <ProgressBar value={progress.evaluated} max={progress.total} />

            {waiting?.key === 'finished' ? (
              <p className="m-0 text-[13px] text-muted">{waitingMessage(waiting)}</p>
            ) : null}
          </div>

          <EvaluationForm
            key={response.id}
            projectId={id}
            roundNumber={roundNumber!}
            response={response}
            label={label}
            cells={cells}
            submitted={submitted}
          />

          {submitted && nextId ? (
            <div>
              <ButtonLink
                variant="secondary"
                href={`/projects/${id}/evaluate?response=${nextId}`}
              >
                Avaliar a próxima resposta
              </ButtonLink>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  )
}
