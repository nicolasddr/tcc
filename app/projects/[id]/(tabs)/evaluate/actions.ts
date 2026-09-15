'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import {
  transaction,
  pgErrorCode,
  evaluations,
  responses,
  rounds,
  scores,
} from '@/lib/db'
import { evaluatorMembershipId } from '@/lib/authz'
import { JUSTIFICATION_MAX } from '@/lib/limits'
import { loadCodebookVersion } from '../../pipeline/codebook'
import { resolveCells } from '../../pipeline/criteria'
import { listRoundResponses } from '../../pipeline/responses'
import { isUuid } from '../../pipeline/versions'
import { isOpen } from '../rounds/rounds'
import { loadEvaluatedResponseIds } from './evaluation'
import { buildQueue, nextPendingId } from './queue'
import { cellKey, definitionsIncomplete, incompleteMessage, type Answer } from './completeness'
import { isScaleValue } from './scale'

export type EvaluationState = { error: string } | { ok: true; nonce: number } | null

const INVALID = 'Avaliação inválida.'

const DENIED =
  'Não foi possível enviar a avaliação. Apenas quem tem vínculo de avaliador ativo neste projeto pode avaliar.'

const RESPONSE_MISSING =
  'Esta resposta não existe mais nesta rodada. Recarregue a página para ver a lista atual.'

const CODEBOOK_MISSING =
  'Não foi possível ler a versão de codebook que esta rodada fixou. Recarregue a página.'

const ALREADY_SUBMITTED =
  'Você já enviou a avaliação desta resposta, e o envio é definitivo. Recarregue a página para vê-la.'

const OUT_OF_SCALE =
  'Uma das notas está fora da escala. Recarregue a página e dê as notas de novo.'

const JUSTIFICATION_TOO_LONG = `Uma das justificativas passa do limite de ${JUSTIFICATION_MAX} caracteres.`

function closedRoundMessage(roundNumber: number): string {
  return (
    `A rodada ${roundNumber} já foi fechada, e rodada fechada não recebe mais ` +
    'avaliação. Aguarde a próxima rodada para avaliar.'
  )
}

type SubmitOutcome =
  | { status: 'missing' }
  | { status: 'closed'; roundNumber: number }
  | { status: 'duplicate' }
  | { status: 'no_codebook' }
  | { status: 'out_of_scale' }
  | { status: 'too_long' }
  | { status: 'incomplete'; titles: string[] }
  | { status: 'ok'; nextId: string | null }

export async function submitEvaluation(
  _prev: EvaluationState,
  formData: FormData,
): Promise<EvaluationState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const responseId = String(formData.get('response_id') ?? '')
  if (!isUuid(projectId) || !isUuid(responseId)) return { error: INVALID }

  const memberId = await evaluatorMembershipId(userId, projectId)
  if (!memberId) return { error: DENIED }

  let outcome: SubmitOutcome
  try {
    outcome = await transaction<SubmitOutcome>(async (tx) => {
      const [response] = await tx
        .select({
          id: responses.id,
          roundId: rounds.id,
          roundNumber: rounds.roundNumber,
          status: rounds.status,
          codebookVersionId: rounds.codebookVersionId,
        })
        .from(responses)
        .innerJoin(rounds, eq(rounds.id, responses.roundId))
        .where(and(eq(responses.id, responseId), eq(rounds.projectId, projectId)))
        .limit(1)

      if (!response) return { status: 'missing' }
      if (!isOpen(response)) {
        return { status: 'closed', roundNumber: response.roundNumber }
      }

      const [existing] = await tx
        .select({ id: evaluations.id })
        .from(evaluations)
        .where(
          and(
            eq(evaluations.responseId, responseId),
            eq(evaluations.projectMemberId, memberId),
          ),
        )
        .limit(1)

      if (existing) return { status: 'duplicate' }

      const codebook = await loadCodebookVersion(projectId, response.codebookVersionId, tx)
      if (!codebook) return { status: 'no_codebook' }

      const cells = resolveCells(codebook.definitions, codebook.criteria)
      const answers: Answer[] = []

      for (const cell of cells) {
        const key = cellKey({
          definitionId: cell.definition.id,
          criterionId: cell.criterion.id,
        })
        const value = String(formData.get(`score_${key}`) ?? '').trim()
        const justification = String(formData.get(`justification_${key}`) ?? '').trim()

        if (justification.length > JUSTIFICATION_MAX) return { status: 'too_long' }
        if (value !== '' && !isScaleValue(value)) return { status: 'out_of_scale' }

        answers.push({
          definitionId: cell.definition.id,
          criterionId: cell.criterion.id,
          value,
          justification,
        })
      }

      const incomplete = definitionsIncomplete(cells, answers)
      if (incomplete.length > 0) {
        return { status: 'incomplete', titles: incomplete.map((d) => d.title) }
      }

      const [evaluation] = await tx
        .insert(evaluations)
        .values({
          roundId: response.roundId,
          responseId,
          projectMemberId: memberId,
        })
        .returning({ id: evaluations.id })

      if (answers.length > 0) {
        await tx.insert(scores).values(
          answers.map((answer) => ({
            evaluationId: evaluation.id,
            definitionId: answer.definitionId,
            criterionId: answer.criterionId,
            value: answer.value,
            justification: answer.justification === '' ? null : answer.justification,
          })),
        )
      }

      const listed = await listRoundResponses(response.roundId, tx)
      const evaluated = await loadEvaluatedResponseIds(response.roundId, memberId, tx)
      const queue = buildQueue(listed, evaluated, memberId, response.roundId)

      return { status: 'ok', nextId: nextPendingId(queue, responseId) }
    })
  } catch (err) {
    if (pgErrorCode(err) === '23505') return { error: ALREADY_SUBMITTED }
    throw err
  }

  if (outcome.status === 'missing') return { error: RESPONSE_MISSING }
  if (outcome.status === 'closed') return { error: closedRoundMessage(outcome.roundNumber) }
  if (outcome.status === 'duplicate') return { error: ALREADY_SUBMITTED }
  if (outcome.status === 'no_codebook') return { error: CODEBOOK_MISSING }
  if (outcome.status === 'out_of_scale') return { error: OUT_OF_SCALE }
  if (outcome.status === 'too_long') return { error: JUSTIFICATION_TOO_LONG }
  if (outcome.status === 'incomplete') return { error: incompleteMessage(outcome.titles) }

  revalidatePath(`/projects/${projectId}/evaluate`)

  if (outcome.nextId) {
    redirect(`/projects/${projectId}/evaluate?response=${outcome.nextId}&sent=1`)
  }

  return { ok: true, nonce: Date.now() }
}
