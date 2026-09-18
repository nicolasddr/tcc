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
import { listReviewableRounds, type ReviewableRound } from '../rounds/review'
import { requireEvaluator } from './access'
import {
  loadEvaluatedResponseIds,
  loadEvaluationOf,
  type SubmittedEvaluation,
} from './evaluation'
import { loadEvaluationContext, type EvaluationContext } from './context'
import { buildQueue, neighbours, pickResponseId } from './queue'
import { progressMessage, type Progress } from './progress'
import { waitingMessage, waitingState, type WaitingState } from './waiting'
import { ContextPanel } from './context-panel'
import { EvaluationForm } from './evaluation-form'
import { QueueNav } from '@/app/components/ui/queue-nav'
import { Alert } from '@/app/components/ui/alert'
import { OpenLink } from '@/app/components/ui/open-link'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Section } from '@/app/components/ui/section'
import { ProgressBar } from '@/app/components/ui/stat'

type EvaluateView = {
  waiting: WaitingState | null
  memberName: string
  roundNumber: number | null
  response: ResponseDetail | null
  label: string
  cells: CodebookCell<CodebookDefinition, CodebookCriterion>[]
  submitted: SubmittedEvaluation | null
  context: EvaluationContext | null
  progress: Progress
  prev: string | null
  next: string | null
  lastReview: ReviewableRound | null
}

const empty: Omit<EvaluateView, 'waiting' | 'memberName' | 'roundNumber'> = {
  response: null,
  label: '',
  cells: [],
  submitted: null,
  context: null,
  progress: { evaluated: 0, total: 0 },
  prev: null,
  next: null,
  lastReview: null,
}

export default async function ProjectEvaluatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ response?: string; sent?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const requested = query.response ?? null
  const justSent = query.sent === '1'
  const userId = await requireUserId()

  const view = await transaction<EvaluateView>(async (tx) => {
    const { project, memberId, memberName } = await requireEvaluator(id, userId, tx)

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
        memberName,
        roundNumber: null,
        ...empty,
        lastReview: (await listReviewableRounds(id, memberId, tx)).at(-1) ?? null,
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
      return { waiting, memberName, roundNumber: round.roundNumber, ...empty, progress }
    }

    if (currentId !== requested) {
      redirect(`/projects/${id}/evaluate?response=${currentId}`)
    }

    const current = queue.find((response) => response.id === currentId)!

    return {
      waiting,
      memberName,
      roundNumber: round.roundNumber,
      response: await loadRoundResponse(round.id, currentId, tx),
      label: current.label,
      cells: codebook ? resolveCells(codebook.definitions, codebook.criteria) : [],
      submitted: await loadEvaluationOf(currentId, memberId, tx),
      context: await loadEvaluationContext(id, currentId, tx),
      progress,
      lastReview: null,
      ...neighbours(queue, currentId),
    }
  })

  const { waiting, memberName, roundNumber, response, label, cells } = view
  const { submitted, context, progress, prev, next, lastReview } = view

  const held = waiting && waiting.key !== 'finished' ? waiting : null
  const route = `/projects/${id}/evaluate?response=`

  return (
    <Section
      title={
        <>
          {roundNumber ? `Avaliar na rodada ${roundNumber}` : 'Avaliar respostas'}
          <span className="text-[13px] font-normal text-muted">
            Avaliando como {memberName}
          </span>
        </>
      }
      hint="Cada resposta é avaliada uma vez, em cada critério de cada definição do codebook que esta rodada fixou. O envio é definitivo."
    >
      {held ? (
        <div className="flex flex-col gap-3">
          <EmptyState>{waitingMessage(held)}</EmptyState>
          {lastReview ? (
            <p className="m-0 text-center text-[13px] text-muted">
              <OpenLink href={`/projects/${id}/rounds/${lastReview.id}`}>
                Abrir a revisão de discordâncias da rodada {lastReview.roundNumber}
              </OpenLink>
            </p>
          ) : null}
        </div>
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

            <QueueNav
              prev={prev ? `${route}${prev}` : null}
              next={next ? `${route}${next}` : null}
            />
          </div>

          {justSent ? (
            <Alert tone="success">
              Avaliação enviada. Esta é a próxima resposta da sua fila.
            </Alert>
          ) : null}

          {context ? <ContextPanel context={context} /> : null}

          <EvaluationForm
            key={response.id}
            projectId={id}
            roundNumber={roundNumber!}
            response={response}
            label={label}
            cells={cells}
            submitted={submitted}
          />
        </div>
      )}
    </Section>
  )
}
