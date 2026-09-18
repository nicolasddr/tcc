'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import {
  transaction,
  pgErrorCode,
  evaluations,
  projectMembers,
  roundOutliers,
  rounds,
} from '@/lib/db'
import { isProjectAdmin } from '@/lib/authz'
import { OUTLIER_REASON_MAX } from '@/lib/limits'

export type OutlierState = { error: string } | { ok: true; nonce: number } | null

const MARK_DENIED =
  'Não foi possível marcar o outlier. Apenas o administrador do projeto pode marcar.'

const UNMARK_DENIED =
  'Não foi possível remover a marca. Apenas o administrador do projeto pode removê-la.'

const REASON_REQUIRED =
  'Escreva por que estas notas saem do cálculo. Tirar um avaliador do coeficiente é uma decisão de método, e a justificativa escrita é o que torna a exclusão defensável e revisável depois.'

const ROUND_MISSING =
  'Esta rodada não existe mais neste projeto. Recarregue a página para ver a lista atual.'

const MEMBER_MISSING =
  'Esta pessoa não participa deste projeto. Recarregue a página para ver a equipe atual.'

const NO_EVALUATION =
  'Esta pessoa não enviou nenhuma avaliação nesta rodada, então não há nota dela para tirar do cálculo. A marca é por rodada, e só faz sentido onde existe nota.'

const ALREADY_MARKED =
  'Esta pessoa já está marcada como outlier nesta rodada. Recarregue a página para ver a marcação atual.'

const MARK_GONE =
  'Esta marca já foi removida. Recarregue a página para ver o estado atual da rodada.'

function reasonTooLongMessage(length: number): string {
  return (
    `A justificativa tem ${length} caracteres e o limite é ${OUTLIER_REASON_MAX}. ` +
    'Encurte o texto para registrar a marcação.'
  )
}

function revalidateOutliers(projectId: string, roundId: string): void {
  revalidatePath(`/projects/${projectId}/members`)
  revalidatePath(`/projects/${projectId}/rounds`)
  revalidatePath(`/projects/${projectId}/rounds/${roundId}`)
  revalidatePath(`/projects/${projectId}`)
}

type MarkOutcome =
  | { status: 'marked' }
  | { status: 'round_missing' }
  | { status: 'member_missing' }
  | { status: 'no_evaluation' }

export async function markOutlier(
  _prev: OutlierState,
  formData: FormData,
): Promise<OutlierState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const roundId = String(formData.get('round_id') ?? '')
  const projectMemberId = String(formData.get('project_member_id') ?? '')
  if (!projectId || !roundId || !projectMemberId) return { error: 'Marcação inválida.' }

  if (!(await isProjectAdmin(userId, projectId))) return { error: MARK_DENIED }

  const reason = String(formData.get('reason') ?? '').trim()
  if (reason === '') return { error: REASON_REQUIRED }
  if (reason.length > OUTLIER_REASON_MAX) {
    return { error: reasonTooLongMessage(reason.length) }
  }

  let outcome: MarkOutcome
  try {
    outcome = await transaction<MarkOutcome>(async (tx) => {
      const [round] = await tx
        .select({ id: rounds.id })
        .from(rounds)
        .where(and(eq(rounds.id, roundId), eq(rounds.projectId, projectId)))
        .limit(1)

      if (!round) return { status: 'round_missing' }

      const [member] = await tx
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.id, projectMemberId),
            eq(projectMembers.projectId, projectId),
          ),
        )
        .limit(1)

      if (!member) return { status: 'member_missing' }

      const [evaluated] = await tx
        .select({ id: evaluations.id })
        .from(evaluations)
        .where(
          and(
            eq(evaluations.roundId, roundId),
            eq(evaluations.projectMemberId, projectMemberId),
          ),
        )
        .limit(1)

      if (!evaluated) return { status: 'no_evaluation' }

      await tx
        .insert(roundOutliers)
        .values({ roundId, projectMemberId, reason, markedBy: userId })

      return { status: 'marked' }
    })
  } catch (err) {
    if (pgErrorCode(err) === '23505') return { error: ALREADY_MARKED }
    throw err
  }

  if (outcome.status === 'round_missing') return { error: ROUND_MISSING }
  if (outcome.status === 'member_missing') return { error: MEMBER_MISSING }
  if (outcome.status === 'no_evaluation') return { error: NO_EVALUATION }

  revalidateOutliers(projectId, roundId)
  return { ok: true, nonce: Date.now() }
}

type UnmarkOutcome = { status: 'removed' } | { status: 'round_missing' } | { status: 'gone' }

export async function unmarkOutlier(
  _prev: OutlierState,
  formData: FormData,
): Promise<OutlierState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const roundId = String(formData.get('round_id') ?? '')
  const markId = String(formData.get('mark_id') ?? '')
  if (!projectId || !roundId || !markId) return { error: 'Marcação inválida.' }

  if (!(await isProjectAdmin(userId, projectId))) return { error: UNMARK_DENIED }

  const outcome = await transaction<UnmarkOutcome>(async (tx) => {
    const [round] = await tx
      .select({ id: rounds.id })
      .from(rounds)
      .where(and(eq(rounds.id, roundId), eq(rounds.projectId, projectId)))
      .limit(1)

    if (!round) return { status: 'round_missing' }

    const removed = await tx
      .update(roundOutliers)
      .set({ removedBy: userId, removedAt: sql`now()` })
      .where(
        and(
          eq(roundOutliers.id, markId),
          eq(roundOutliers.roundId, roundId),
          isNull(roundOutliers.removedAt),
        ),
      )
      .returning({ id: roundOutliers.id })

    return removed.length === 0 ? { status: 'gone' } : { status: 'removed' }
  })

  if (outcome.status === 'round_missing') return { error: ROUND_MISSING }
  if (outcome.status === 'gone') return { error: MARK_GONE }

  revalidateOutliers(projectId, roundId)
  return { ok: true, nonce: Date.now() }
}
