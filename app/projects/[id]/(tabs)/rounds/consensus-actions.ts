'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import {
  transaction,
  type Transaction,
  codebookCriteria,
  codebookDefinitions,
  consensusNotes,
  responses,
  rounds,
} from '@/lib/db'
import { CONSENSUS_NOTE_MAX } from '@/lib/limits'
import { isUuid } from '../../pipeline/versions'
import { isGeneral } from '../../pipeline/criteria'
import { CONSENSUS_PRIVATE, CONSENSUS_SHARED } from './consensus'
import { loadReviewMemberships } from './review-access'
import { listEvaluatedRoundIds } from './review'
import { ROUND_CLOSED } from './rounds'

export type ConsensusState =
  | { error: string }
  | { ok: true; saved: boolean; nonce: number }
  | null

const INVALID = 'Anotação inválida. Recarregue a página e tente de novo.'

const DENIED =
  'Não foi possível salvar a anotação. Só quem participa deste projeto registra a discussão de uma rodada dele.'

const ROUND_MISSING =
  'Esta rodada não existe mais neste projeto. Recarregue a página para ver a lista atual.'

const ROUND_OPEN =
  'A revisão abre quando a rodada fecha. Anotar consenso sobre resultado parcial registra uma decisão que a equipe ainda não podia ter tomado.'

const RESPONSE_MISSING =
  'Esta resposta não pertence a esta rodada. Recarregue a página para ver as respostas atuais.'

const ROUND_DENIED =
  'Você não avaliou nesta rodada, então não alcança a discussão dela. A anotação fica presa à rodada em que se avaliou, porque é o registro do que a equipe decidiu sobre aquelas notas.'

const CELL_MISSING =
  'Esta célula não existe na versão de codebook que a rodada congelou. Recarregue a página para ver as células atuais.'

function textTooLongMessage(length: number): string {
  return (
    `A anotação tem ${length} caracteres e o limite é ${CONSENSUS_NOTE_MAX}. ` +
    'Encurte o texto para salvar.'
  )
}

type Cell = { definitionId: string; criterionId: string }

type Outcome =
  | { status: 'saved' }
  | { status: 'removed' }
  | { status: 'too_long'; length: number }
  | { status: 'denied' }
  | { status: 'round_missing' }
  | { status: 'round_open' }
  | { status: 'response_missing' }
  | { status: 'round_denied' }
  | { status: 'cell_missing' }

async function cellExists(
  tx: Transaction,
  codebookVersionId: string,
  cell: Cell,
): Promise<boolean> {
  const [definition] = await tx
    .select({ id: codebookDefinitions.id })
    .from(codebookDefinitions)
    .where(
      and(
        eq(codebookDefinitions.id, cell.definitionId),
        eq(codebookDefinitions.codebookVersionId, codebookVersionId),
      ),
    )
    .limit(1)

  if (!definition) return false

  const [criterion] = await tx
    .select({ definitionId: codebookCriteria.definitionId })
    .from(codebookCriteria)
    .where(
      and(
        eq(codebookCriteria.id, cell.criterionId),
        eq(codebookCriteria.codebookVersionId, codebookVersionId),
      ),
    )
    .limit(1)

  if (!criterion) return false

  return isGeneral(criterion) || criterion.definitionId === cell.definitionId
}

export async function saveConsensusNote(
  _prev: ConsensusState,
  formData: FormData,
): Promise<ConsensusState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const roundId = String(formData.get('round_id') ?? '')
  const responseId = String(formData.get('response_id') ?? '')
  const definitionId = String(formData.get('definition_id') ?? '')
  const criterionId = String(formData.get('criterion_id') ?? '')
  const ids = [projectId, roundId, responseId, definitionId, criterionId]
  if (!ids.every(isUuid)) return { error: INVALID }

  const text = String(formData.get('text') ?? '').trim()

  const outcome = await transaction<Outcome>(async (tx) => {
    const { adminMemberId, evaluatorMemberId } = await loadReviewMemberships(
      projectId,
      userId,
      tx,
    )
    const projectMemberId = adminMemberId ?? evaluatorMemberId
    if (!projectMemberId) return { status: 'denied' }
    const visibility = adminMemberId ? CONSENSUS_SHARED : CONSENSUS_PRIVATE

    const [round] = await tx
      .select({ status: rounds.status, codebookVersionId: rounds.codebookVersionId })
      .from(rounds)
      .where(and(eq(rounds.id, roundId), eq(rounds.projectId, projectId)))
      .limit(1)

    if (!round) return { status: 'round_missing' }
    if (round.status !== ROUND_CLOSED) return { status: 'round_open' }

    const [response] = await tx
      .select({ id: responses.id })
      .from(responses)
      .where(and(eq(responses.id, responseId), eq(responses.roundId, roundId)))
      .limit(1)

    if (!response) return { status: 'response_missing' }

    if (!adminMemberId) {
      const evaluated = await listEvaluatedRoundIds(projectId, projectMemberId, tx)
      if (!evaluated.includes(roundId)) return { status: 'round_denied' }
    }

    if (!(await cellExists(tx, round.codebookVersionId, { definitionId, criterionId }))) {
      return { status: 'cell_missing' }
    }

    const key = and(
      eq(consensusNotes.responseId, responseId),
      eq(consensusNotes.definitionId, definitionId),
      eq(consensusNotes.criterionId, criterionId),
      eq(consensusNotes.projectMemberId, projectMemberId),
    )

    if (text === '') {
      await tx.delete(consensusNotes).where(key)
      return { status: 'removed' }
    }

    if (text.length > CONSENSUS_NOTE_MAX) {
      return { status: 'too_long', length: text.length }
    }

    await tx
      .insert(consensusNotes)
      .values({
        roundId,
        responseId,
        definitionId,
        criterionId,
        projectMemberId,
        visibility,
        text,
      })
      .onConflictDoUpdate({
        target: [
          consensusNotes.responseId,
          consensusNotes.definitionId,
          consensusNotes.criterionId,
          consensusNotes.projectMemberId,
        ],
        set: { text, updatedAt: sql`now()` },
      })

    return { status: 'saved' }
  })

  if (outcome.status === 'denied') return { error: DENIED }
  if (outcome.status === 'round_missing') return { error: ROUND_MISSING }
  if (outcome.status === 'round_open') return { error: ROUND_OPEN }
  if (outcome.status === 'response_missing') return { error: RESPONSE_MISSING }
  if (outcome.status === 'round_denied') return { error: ROUND_DENIED }
  if (outcome.status === 'cell_missing') return { error: CELL_MISSING }
  if (outcome.status === 'too_long') return { error: textTooLongMessage(outcome.length) }

  revalidatePath(`/projects/${projectId}/rounds/${roundId}`)
  return { ok: true, saved: outcome.status === 'saved', nonce: Date.now() }
}
