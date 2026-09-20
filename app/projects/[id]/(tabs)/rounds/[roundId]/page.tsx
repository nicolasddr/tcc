import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import {
  loadCodebookVersion,
  type CodebookCriterion,
  type CodebookDefinition,
} from '../../../pipeline/codebook'
import { listRoundResponses } from '../../../pipeline/responses'
import { responseLabel } from '../../evaluate/queue'
import { isOpen } from '../rounds'
import { loadResponseNotes, type ResponseNote, type ReviewRound } from '../review'
import {
  loadReviewMemberships,
  requireReviewAccess,
  requireReviewableRound,
} from '../review-access'
import { loadRoundOutliers, type OutlierMark } from '../outliers'
import { loadResponseConsensus, type ConsensusNote } from '../consensus'
import { consensusByCell } from '../consensus-cells'
import { divergentCells, ratedCells, reviewGroups, type CellNote } from '../review-groups'
import {
  ReviewGroupsList,
  divergenceSummary,
  type ConsensusContext,
} from '../review-groups-list'
import { QueueNav } from '@/app/components/ui/queue-nav'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Section } from '@/app/components/ui/section'
import { BackLink } from '@/app/components/ui/shell'
import { formatDate } from '@/app/notifications/labels'

type LabeledResponse = { id: string; label: string }

function markOutliers(
  notes: readonly ResponseNote[],
  marks: readonly OutlierMark[],
): CellNote[] {
  const reasons = new Map(marks.map((mark) => [mark.projectMemberId, mark.reason]))

  return notes.map((note) => {
    const reason = reasons.get(note.projectMemberId) ?? null
    return { ...note, isOutlier: reason !== null, outlierReason: reason }
  })
}

type ReviewView = {
  round: ReviewRound
  current: LabeledResponse | null
  prev: string | null
  next: string | null
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  notes: CellNote[]
  consensus: ConsensusNote[]
  authorMemberId: string | null
  canWriteMinutes: boolean
}

export default async function RoundReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; roundId: string }>
  searchParams: Promise<{ response?: string }>
}) {
  const { id, roundId } = await params
  const query = await searchParams
  const requested = query.response ?? null
  const userId = await requireUserId()

  const view = await transaction<ReviewView>(async (tx) => {
    const access = await requireReviewAccess(id, userId, tx)
    const round = await requireReviewableRound(access, roundId, tx)

    const empty = {
      round,
      current: null,
      prev: null,
      next: null,
      definitions: [],
      criteria: [],
      notes: [],
      consensus: [],
      authorMemberId: null,
      canWriteMinutes: false,
    }

    if (isOpen(round)) return empty

    const listed = await listRoundResponses(round.id, tx)
    const labeled = listed.map((response, position) => ({
      id: response.id,
      label: responseLabel(position),
    }))

    const index = Math.max(
      labeled.findIndex((response) => response.id === requested),
      0,
    )
    const current = labeled[index]
    if (!current) return empty

    const codebook = await loadCodebookVersion(id, round.codebookVersionId, tx)

    const { adminMemberId, evaluatorMemberId } = await loadReviewMemberships(
      id,
      userId,
      tx,
    )
    const memberIds = [adminMemberId, evaluatorMemberId].filter(
      (memberId) => memberId !== null,
    )

    return {
      round,
      current,
      prev: labeled[index - 1]?.id ?? null,
      next: labeled[index + 1]?.id ?? null,
      definitions: codebook?.definitions ?? [],
      criteria: codebook?.criteria ?? [],
      notes: markOutliers(
        await loadResponseNotes(current.id, tx),
        access.isAdmin ? await loadRoundOutliers(round.id, tx) : [],
      ),
      consensus: await loadResponseConsensus(current.id, memberIds, tx),
      authorMemberId: adminMemberId ?? evaluatorMemberId,
      canWriteMinutes: adminMemberId !== null,
    }
  })

  const { round, current, prev, next, definitions, criteria, notes } = view
  const { consensus, authorMemberId, canWriteMinutes } = view

  const groups = reviewGroups(definitions, criteria, notes)
  const cells = groups.reduce((total, group) => total + group.cells.length, 0)
  const unrated = cells - ratedCells(groups)
  const route = `/projects/${id}/rounds/${roundId}?response=`

  const consensusContext: ConsensusContext | null = current
    ? {
        projectId: id,
        roundId,
        responseId: current.id,
        canWriteMinutes,
        byCell: consensusByCell(consensus, authorMemberId),
      }
    : null

  return (
    <>
      <div className="mt-6">
        <BackLink href={`/projects/${id}/rounds`}>Voltar às rodadas</BackLink>
      </div>

      <Section
        title={`Revisão de discordâncias da rodada ${round.roundNumber}`}
        hint={
          round.closedAt
            ? `Uma resposta por vez, sobre a versão de codebook que esta rodada fixou (Codebook v${round.codebookVersionNumber}). A rodada fechou em ${formatDate(round.closedAt)}, e a discussão fica presa a ela: o que se refina aqui vale para a próxima.`
            : 'Uma resposta por vez, com todas as células da versão de codebook que esta rodada fixou e as divergentes destacadas.'
        }
      >
        {isOpen(round) ? (
          <EmptyState>
            A revisão de discordâncias da rodada {round.roundNumber} abre quando ela
            fechar. Enquanto a rodada está aberta ainda há avaliação por chegar, e ler as
            notas agora seria discutir um resultado parcial.
          </EmptyState>
        ) : !current ? (
          <EmptyState>
            A rodada {round.roundNumber} fechou sem nenhuma resposta gerada, então não há
            o que revisar nela.
          </EmptyState>
        ) : cells === 0 ? (
          <EmptyState>
            A versão de codebook que esta rodada fixou (Codebook v
            {round.codebookVersionNumber}) não tem definição e critério para cruzar, então
            não há célula para revisar.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[13px] font-semibold text-ink">
                  {current.label}
                </span>
                <span className="text-[13px] text-muted">
                  {divergenceSummary(divergentCells(groups), cells)}
                  {unrated > 0
                    ? ` · ${unrated} ${unrated === 1 ? 'célula' : 'células'} sem nota`
                    : null}
                </span>
              </div>

              <QueueNav
                prev={prev ? `${route}${prev}` : null}
                next={next ? `${route}${next}` : null}
              />
            </div>

            <ReviewGroupsList groups={groups} consensus={consensusContext} />
          </div>
        )}
      </Section>
    </>
  )
}
