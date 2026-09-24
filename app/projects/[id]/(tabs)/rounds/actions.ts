'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import {
  transaction,
  pgErrorCode,
  projects,
  codebookVersions,
  promptVersions,
  inputItems,
  responses,
  rounds,
} from '@/lib/db'
import { isProjectAdmin } from '@/lib/authz'
import { askLlm } from '@/lib/ai'
import { llmFailureOf } from '@/lib/ai/failure'
import {
  countProjectResponse,
  hasProjectResponsesLeft,
  projectResponsesMax,
} from '@/lib/ai/quota'
import { RESPONSE_TEXT_MAX } from '@/lib/limits'
import { loadCodebook } from '../../pipeline/codebook'
import { loadPrompt } from '../../pipeline/prompt'
import { loadItems } from '../../pipeline/items'
import { composeLlmInput } from '../../pipeline/llm-input'
import { PHASE_2 } from '../../pipeline/preconditions'
import {
  loadItemsUsedInRound,
  loadRoundComposition,
  type RoundComposition,
} from '../../pipeline/responses'
import { isOpen, loadOpenRound, ROUND_CLOSED, ROUND_OPEN } from './rounds'
import {
  ceilingReachedMessage,
  roundBlockerMessage,
  roundBlockers,
  selectionBlockerMessage,
  selectionBlockers,
  type GenerationFailure,
} from './preconditions'

export type NewRoundState =
  | { error: string }
  | { ok: true; nonce: number; roundNumber: number }
  | null

export type CloseRoundState =
  | { error: string }
  | { ok: true; nonce: number; roundNumber: number }
  | null

const CREATE_DENIED =
  'Não foi possível criar a rodada. Apenas o administrador do projeto pode criá-la.'

const CLOSE_DENIED =
  'Não foi possível fechar a rodada. Apenas o administrador do projeto pode fechá-la.'

const PROJECT_MISSING =
  'Este projeto não existe mais. Recarregue a página para ver a lista atual.'

const ROUND_MISSING =
  'Esta rodada não existe mais neste projeto. Recarregue a página para ver a lista atual.'

const RACED =
  'Outra rodada foi aberta ao mesmo tempo, e só existe uma rodada aberta por projeto. Recarregue a página para ver a rodada aberta.'

function alreadyClosedMessage(roundNumber: number): string {
  return (
    `A rodada ${roundNumber} já foi fechada, e fechar é irreversível. ` +
    'Recarregue a página para ver o estado atual.'
  )
}

function revalidateRounds(projectId: string): void {
  revalidatePath(`/projects/${projectId}/rounds`)
  revalidatePath(`/projects/${projectId}/codebook`)
  revalidatePath(`/projects/${projectId}/prompt`)
  revalidatePath(`/projects/${projectId}`)
}

export async function createRound(
  _prev: NewRoundState,
  formData: FormData,
): Promise<NewRoundState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  if (!(await isProjectAdmin(userId, projectId))) return { error: CREATE_DENIED }

  let failure: string | null = null
  let roundNumber = 0

  try {
    await transaction(async (tx) => {
      const [project] = await tx
        .select({ id: projects.id, phase: projects.phase })
        .from(projects)
        .where(eq(projects.id, projectId))
        .for('update')

      if (!project) {
        failure = PROJECT_MISSING
        return
      }

      const codebook = await loadCodebook(projectId, tx)
      const prompt = await loadPrompt(projectId, tx)
      const open = await loadOpenRound(projectId, tx)

      const blockers = roundBlockers({
        phase: project.phase,
        definitions: codebook.definitions,
        criteria: codebook.criteria,
        hasPromptVersion: prompt.version !== null,
        openRoundNumber: open?.roundNumber ?? null,
      })

      if (blockers.length > 0 || !codebook.version || !prompt.version) {
        failure = roundBlockerMessage(blockers[0] ?? { key: 'definition' })
        return
      }

      const [last] = await tx
        .select({ roundNumber: rounds.roundNumber })
        .from(rounds)
        .where(eq(rounds.projectId, projectId))
        .orderBy(desc(rounds.roundNumber))
        .limit(1)

      roundNumber = (last?.roundNumber ?? 0) + 1

      await tx.insert(rounds).values({
        projectId,
        roundNumber,
        status: ROUND_OPEN,
        codebookVersionId: codebook.version.id,
        promptVersionId: prompt.version.id,
        createdBy: userId,
      })

      await tx
        .update(codebookVersions)
        .set({ usedAt: sql`now()` })
        .where(
          and(
            eq(codebookVersions.id, codebook.version.id),
            isNull(codebookVersions.usedAt),
          ),
        )

      await tx
        .update(promptVersions)
        .set({ usedAt: sql`now()` })
        .where(
          and(eq(promptVersions.id, prompt.version.id), isNull(promptVersions.usedAt)),
        )
    })
  } catch (err) {
    if (pgErrorCode(err) === '23505') return { error: RACED }
    throw err
  }

  if (failure) return { error: failure }

  revalidateRounds(projectId)
  return { ok: true, nonce: Date.now(), roundNumber }
}

type CloseOutcome =
  | { status: 'closed'; roundNumber: number }
  | { status: 'already_closed'; roundNumber: number }
  | { status: 'missing' }

export async function closeRound(
  _prev: CloseRoundState,
  formData: FormData,
): Promise<CloseRoundState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const roundId = String(formData.get('round_id') ?? '')
  if (!projectId || !roundId) return { error: 'Rodada inválida.' }

  if (!(await isProjectAdmin(userId, projectId))) return { error: CLOSE_DENIED }

  const outcome = await transaction<CloseOutcome>(async (tx) => {
    const [round] = await tx
      .select({
        id: rounds.id,
        roundNumber: rounds.roundNumber,
        status: rounds.status,
      })
      .from(rounds)
      .where(and(eq(rounds.id, roundId), eq(rounds.projectId, projectId)))
      .limit(1)
      .for('update')

    if (!round) return { status: 'missing' }
    if (round.status !== ROUND_OPEN) {
      return { status: 'already_closed', roundNumber: round.roundNumber }
    }

    await tx
      .update(rounds)
      .set({ status: ROUND_CLOSED, closedAt: sql`now()` })
      .where(eq(rounds.id, roundId))

    return { status: 'closed', roundNumber: round.roundNumber }
  })

  if (outcome.status === 'missing') return { error: ROUND_MISSING }
  if (outcome.status === 'already_closed') {
    return { error: alreadyClosedMessage(outcome.roundNumber) }
  }

  revalidateRounds(projectId)
  return { ok: true, nonce: Date.now(), roundNumber: outcome.roundNumber }
}

export type GeneratedResponse = { responseId: string; itemId: string }

export type FailedGeneration = { itemId: string; failure: GenerationFailure }

export type GenerateResponsesState =
  | { error: string }
  | {
      ok: true
      nonce: number
      created: GeneratedResponse[]
      failed: FailedGeneration[]
    }
  | null

const GENERATE_DENIED =
  'Não foi possível gerar as respostas. Apenas o administrador do projeto pode gerá-las.'

const GENERATE_ROUND_MISSING =
  'Esta rodada não existe mais neste projeto. Recarregue a página para ver a lista atual.'

const GENERATE_VERSIONS_MISSING =
  'Não foi possível ler as versões de codebook e de prompt que esta rodada fixou. Recarregue a página.'

function generateClosedMessage(roundNumber: number): string {
  return (
    `A rodada ${roundNumber} já foi fechada, e rodada fechada não recebe mais ` +
    'resposta. Abra a próxima rodada para gerar de novo.'
  )
}

type GenerationSetup =
  | { status: 'missing' }
  | { status: 'closed'; roundNumber: number }
  | { status: 'no_versions' }
  | { status: 'blocked'; message: string }
  | { status: 'ready'; composition: RoundComposition; contents: Map<string, string> }

async function setUpGeneration(
  projectId: string,
  roundId: string,
  selected: string[],
): Promise<GenerationSetup> {
  return transaction<GenerationSetup>(async (tx) => {
    const [round] = await tx
      .select({ id: rounds.id, roundNumber: rounds.roundNumber, status: rounds.status })
      .from(rounds)
      .where(and(eq(rounds.id, roundId), eq(rounds.projectId, projectId)))
      .limit(1)

    if (!round) return { status: 'missing' }
    if (!isOpen(round)) return { status: 'closed', roundNumber: round.roundNumber }

    const composition = await loadRoundComposition(projectId, roundId, tx)
    if (!composition) return { status: 'no_versions' }

    const items = await loadItems(projectId, tx)
    const usedInRound = await loadItemsUsedInRound(roundId, tx)

    const blockers = selectionBlockers(selected, {
      available: items.map((item) => item.id),
      usedInRound,
    })
    if (blockers.length > 0) {
      return { status: 'blocked', message: selectionBlockerMessage(blockers[0]) }
    }

    return {
      status: 'ready',
      composition,
      contents: new Map(items.map((item) => [item.id, item.content])),
    }
  })
}

export async function generateResponses(
  _prev: GenerateResponsesState,
  formData: FormData,
): Promise<GenerateResponsesState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const roundId = String(formData.get('round_id') ?? '')
  if (!projectId || !roundId) return { error: 'Rodada inválida.' }

  if (!(await isProjectAdmin(userId, projectId))) return { error: GENERATE_DENIED }

  const selected = formData.getAll('item_ids').map((value) => String(value))

  const setup = await setUpGeneration(projectId, roundId, selected)

  if (setup.status === 'missing') return { error: GENERATE_ROUND_MISSING }
  if (setup.status === 'closed') return { error: generateClosedMessage(setup.roundNumber) }
  if (setup.status === 'no_versions') return { error: GENERATE_VERSIONS_MISSING }
  if (setup.status === 'blocked') return { error: setup.message }

  if (!hasProjectResponsesLeft(projectId)) {
    return { error: ceilingReachedMessage(projectResponsesMax()) }
  }

  const { composition, contents } = setup
  const created: GeneratedResponse[] = []
  const failed: FailedGeneration[] = []

  for (const itemId of selected) {
    if (!hasProjectResponsesLeft(projectId)) {
      failed.push({ itemId, failure: 'ceiling' })
      continue
    }

    const input = composeLlmInput({
      phase: PHASE_2,
      promptText: composition.promptText,
      definitions: composition.definitionTitles.map((title) => ({
        id: '',
        title,
        description: null,
      })),
      criteria: [],
      itemContent: contents.get(itemId)!,
    })

    let text: string
    let model: string
    let modelVersion: string
    try {
      const answer = await askLlm(input)
      text = answer.text
      model = answer.model
      modelVersion = answer.modelVersion
    } catch (cause) {
      failed.push({ itemId, failure: llmFailureOf(cause) })
      continue
    }

    if (text.trim() === '') {
      failed.push({ itemId, failure: 'blank' })
      continue
    }
    if (text.length > RESPONSE_TEXT_MAX) {
      failed.push({ itemId, failure: 'too_long' })
      continue
    }

    let responseId: string
    try {
      responseId = await transaction(async (tx) => {
        const [row] = await tx
          .insert(responses)
          .values({
            roundId,
            inputItemId: itemId,
            text,
            model,
            modelVersion,
            promptVersionId: composition.promptVersionId,
            codebookVersionId: composition.codebookVersionId,
            createdBy: userId,
          })
          .returning({ id: responses.id })

        await tx
          .update(inputItems)
          .set({ usedAt: sql`now()` })
          .where(and(eq(inputItems.id, itemId), isNull(inputItems.usedAt)))

        return row.id
      })
    } catch (err) {
      if (pgErrorCode(err) === '23505') {
        failed.push({ itemId, failure: 'duplicate' })
        continue
      }
      throw err
    }

    countProjectResponse(projectId)
    created.push({ responseId, itemId })
  }

  revalidateRounds(projectId)
  revalidatePath(`/projects/${projectId}/items`)

  return { ok: true, nonce: Date.now(), created, failed }
}
