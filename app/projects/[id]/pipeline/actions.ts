'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, sql } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import {
  transaction,
  pgErrorCode,
  type Transaction,
  projects,
  codebookVersions,
  codebookDefinitions,
  codebookCriteria,
  promptVersions,
  inputItems,
} from '@/lib/db'
import { isProjectAdmin } from '@/lib/authz'
import { askLlm, type LlmAnswer } from '@/lib/ai'
import { llmFailureOf, type LlmFailure } from '@/lib/ai/failure'
import {
  countProjectResponse,
  hasProjectResponsesLeft,
  projectResponsesMax,
} from '@/lib/ai/quota'
import { decideMetadataSave, decideSave, decideTextSave, isUsed } from '@/lib/versioning'
import {
  normalizeDefinitionType,
  type DefinitionType,
} from '@/app/projects/definition-types'
import { loadCodebook } from './codebook'
import { definitionsWithoutCriteria, missingCriteriaMessage } from './criteria'
import { loadPrompt, type PromptMetadata } from './prompt'
import { composeLlmInput } from './llm-input'
import {
  PHASE_1,
  PHASE_2,
  canAdvanceFromPhase1,
  missingInputsMessage,
  pendingRequirements,
} from './preconditions'
import { loadPipelineInputs } from './inputs'
import { itemContentError, normalizeItemContent } from './item-content'
import {
  CODEBOOK_NOTE_MAX,
  CRITERION_DESCRIPTION_MAX,
  CRITERION_NAME_MAX,
  DEFINITION_DESCRIPTION_MAX,
  DEFINITION_TITLE_MAX,
  ITEM_NAME_MAX,
  PROMPT_CHANGE_LOG_MAX,
  PROMPT_DESCRIPTION_MAX,
  PROMPT_NAME_MAX,
  PROMPT_TEXT_MAX,
} from '@/lib/limits'

export type CodebookState = { error: string } | { ok: true; nonce: number } | null

type ParsedDefinition = {
  title: string
  type: DefinitionType
  description: string | null
}

type ParsedCriterion = {
  definitionIndex: number | null
  name: string
  description: string | null
  orderIndex: number
}

type ParsedCodebook = {
  definitions: ParsedDefinition[]
  criteria: ParsedCriterion[]
  note: string | null
}

const DENIED =
  'Não foi possível salvar as definições. Apenas o administrador do projeto pode editá-las.'

const STALE =
  'Esta não é mais a versão vigente do codebook, e versão congelada não é editável. Recarregue a página para continuar da versão atual.'

const RACED =
  'Outro salvamento criou uma versão ao mesmo tempo. Recarregue a página e salve de novo.'

const DESCRIPTION_TOO_EARLY =
  'A descrição das definições é escrita a partir da Fase 2, e este projeto ainda está na Fase 1. Recarregue a página para ver a fase atual.'

const CRITERIA_TOO_EARLY =
  'Os critérios do codebook são criados a partir da Fase 2, e este projeto ainda está na Fase 1. Recarregue a página para ver a fase atual.'

const GENERAL_SCOPE = 'general'

function parseCriteria(
  formData: FormData,
  definitionCount: number,
): { error: string } | { criteria: ParsedCriterion[] } {
  const names = formData.getAll('criterion_name').map(String)
  const scopes = formData.getAll('criterion_scope').map(String)
  const descriptions = formData.getAll('criterion_description').map(String)

  if (names.length !== scopes.length) {
    return { error: 'Não foi possível ler os critérios enviados.' }
  }
  if (descriptions.length > 0 && descriptions.length !== names.length) {
    return { error: 'Não foi possível ler os critérios enviados.' }
  }

  const criteria: ParsedCriterion[] = []
  const nextOrder = new Map<string, number>()

  for (let i = 0; i < names.length; i++) {
    const name = names[i].trim()
    if (!name) return { error: 'Todo critério precisa de um nome.' }
    if (name.length > CRITERION_NAME_MAX) {
      return {
        error: `O nome do critério pode ter no máximo ${CRITERION_NAME_MAX} caracteres.`,
      }
    }

    const scope = scopes[i]
    let definitionIndex: number | null = null
    if (scope !== GENERAL_SCOPE) {
      definitionIndex = Number(scope)
      if (
        !Number.isInteger(definitionIndex) ||
        definitionIndex < 0 ||
        definitionIndex >= definitionCount
      ) {
        return { error: 'Todo critério precisa pertencer a uma definição ou ser geral.' }
      }
    }

    const description = (descriptions[i] ?? '').replace(/\r\n/g, '\n').trim()
    if (description.length > CRITERION_DESCRIPTION_MAX) {
      return {
        error: `A descrição do critério pode ter no máximo ${CRITERION_DESCRIPTION_MAX} caracteres.`,
      }
    }

    const key = definitionIndex === null ? GENERAL_SCOPE : String(definitionIndex)
    const orderIndex = nextOrder.get(key) ?? 0
    nextOrder.set(key, orderIndex + 1)

    criteria.push({
      definitionIndex,
      name,
      description: description || null,
      orderIndex,
    })
  }

  return { criteria }
}

function parseCodebookForm(formData: FormData): { error: string } | ParsedCodebook {
  const titles = formData.getAll('definition_title').map(String)
  const types = formData.getAll('definition_type').map(String)
  const descriptions = formData.getAll('definition_description').map(String)
  if (titles.length !== types.length) {
    return { error: 'Não foi possível ler as definições enviadas.' }
  }
  if (descriptions.length > 0 && descriptions.length !== titles.length) {
    return { error: 'Não foi possível ler as definições enviadas.' }
  }

  const definitions: ParsedDefinition[] = []
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i].trim()
    if (!title) return { error: 'Toda definição precisa de um título.' }
    if (title.length > DEFINITION_TITLE_MAX) {
      return {
        error: `O título da definição pode ter no máximo ${DEFINITION_TITLE_MAX} caracteres.`,
      }
    }
    const type = normalizeDefinitionType(types[i])
    if (!type) return { error: 'Escolha um tipo válido para cada definição.' }

    const description = (descriptions[i] ?? '').replace(/\r\n/g, '\n').trim()
    if (description.length > DEFINITION_DESCRIPTION_MAX) {
      return {
        error: `A descrição da definição pode ter no máximo ${DEFINITION_DESCRIPTION_MAX} caracteres.`,
      }
    }

    definitions.push({ title, type, description: description || null })
  }

  if (definitions.length === 0) {
    return { error: 'É preciso ao menos uma definição para salvar o codebook.' }
  }

  const criteria = parseCriteria(formData, definitions.length)
  if ('error' in criteria) return criteria

  const note = String(formData.get('note') ?? '').trim()
  if (note.length > CODEBOOK_NOTE_MAX) {
    return { error: `A observação pode ter no máximo ${CODEBOOK_NOTE_MAX} caracteres.` }
  }

  return { definitions, criteria: criteria.criteria, note: note || null }
}

export async function saveCodebook(
  _prev: CodebookState,
  formData: FormData,
): Promise<CodebookState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  const parsed = parseCodebookForm(formData)
  if ('error' in parsed) return parsed

  if (!(await isProjectAdmin(userId, projectId))) return { error: DENIED }

  const targetVersionId = String(formData.get('version_id') ?? '') || null

  let failure: string | null = null
  try {
    await transaction(async (tx) => {
      const [project] = await tx
        .select({ id: projects.id, phase: projects.phase })
        .from(projects)
        .where(eq(projects.id, projectId))
        .for('update')

      const phase = project?.phase ?? PHASE_1
      const describes = parsed.definitions.some((d) => d.description !== null)
      if (describes && phase < PHASE_2) {
        failure = DESCRIPTION_TOO_EARLY
        return
      }
      if (parsed.criteria.length > 0 && phase < PHASE_2) {
        failure = CRITERIA_TOO_EARLY
        return
      }
      if (phase >= PHASE_2) {
        const uncovered = definitionsWithoutCriteria(
          parsed.definitions.map((definition, index) => ({
            id: String(index),
            title: definition.title,
          })),
          parsed.criteria.map((criterion) => ({
            definitionId:
              criterion.definitionIndex === null
                ? null
                : String(criterion.definitionIndex),
          })),
        )
        if (uncovered.length > 0) {
          failure = missingCriteriaMessage(uncovered.map((d) => d.title))
          return
        }
      }

      const [latest] = await tx
        .select({
          id: codebookVersions.id,
          versionNumber: codebookVersions.versionNumber,
          usedAt: codebookVersions.usedAt,
        })
        .from(codebookVersions)
        .where(eq(codebookVersions.projectId, projectId))
        .orderBy(desc(codebookVersions.versionNumber))
        .limit(1)

      const decision = decideSave(latest ?? null, targetVersionId)
      if (decision.mode === 'stale') {
        failure = STALE
        return
      }

      let versionId: string
      if (decision.mode === 'update') {
        versionId = decision.versionId
        await tx
          .update(codebookVersions)
          .set({ note: parsed.note, updatedAt: sql`now()` })
          .where(eq(codebookVersions.id, versionId))
        await tx
          .delete(codebookCriteria)
          .where(eq(codebookCriteria.codebookVersionId, versionId))
        await tx
          .delete(codebookDefinitions)
          .where(eq(codebookDefinitions.codebookVersionId, versionId))
      } else {
        const [created] = await tx
          .insert(codebookVersions)
          .values({
            projectId,
            versionNumber: decision.versionNumber,
            note: parsed.note,
            createdBy: userId,
          })
          .returning({ id: codebookVersions.id })
        versionId = created.id
      }

      const inserted = await tx
        .insert(codebookDefinitions)
        .values(
          parsed.definitions.map((definition, index) => ({
            codebookVersionId: versionId,
            title: definition.title,
            type: definition.type,
            description: definition.description,
            orderIndex: index,
          })),
        )
        .returning({
          id: codebookDefinitions.id,
          orderIndex: codebookDefinitions.orderIndex,
        })

      if (parsed.criteria.length === 0) return

      const definitionIdByIndex = new Map(
        inserted.map((definition) => [definition.orderIndex, definition.id]),
      )

      await tx.insert(codebookCriteria).values(
        parsed.criteria.map((criterion) => ({
          codebookVersionId: versionId,
          definitionId:
            criterion.definitionIndex === null
              ? null
              : (definitionIdByIndex.get(criterion.definitionIndex) ?? null),
          name: criterion.name,
          description: criterion.description,
          orderIndex: criterion.orderIndex,
        })),
      )
    })
  } catch (err) {
    if (pgErrorCode(err) === '23505') return { error: RACED }
    throw err
  }

  if (failure) return { error: failure }

  revalidatePath(`/projects/${projectId}/codebook`)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, nonce: Date.now() }
}

export type PromptState = { error: string } | { ok: true; nonce: number } | null

const PROMPT_DENIED =
  'Não foi possível salvar o prompt. Apenas o administrador do projeto pode editá-lo.'

const PROMPT_STALE =
  'Esta não é mais a versão vigente do prompt, e versão congelada não é editável. Recarregue a página para continuar da versão atual.'

const PROMPT_RACED =
  'Outro salvamento criou uma versão ao mesmo tempo. Recarregue a página e salve de novo.'

function parsePromptText(formData: FormData): { error: string } | { text: string } {
  const text = String(formData.get('text') ?? '').replace(/\r\n/g, '\n')
  if (!text.trim()) return { error: 'O texto do prompt é obrigatório.' }
  if (text.length > PROMPT_TEXT_MAX) {
    return { error: `O texto do prompt pode ter no máximo ${PROMPT_TEXT_MAX} caracteres.` }
  }
  return { text }
}

export async function savePrompt(
  _prev: PromptState,
  formData: FormData,
): Promise<PromptState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  const parsed = parsePromptText(formData)
  if ('error' in parsed) return parsed

  if (!(await isProjectAdmin(userId, projectId))) return { error: PROMPT_DENIED }

  const targetVersionId = String(formData.get('version_id') ?? '') || null

  let stale = false
  try {
    await transaction(async (tx) => {
      await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .for('update')

      const [latest] = await tx
        .select({
          id: promptVersions.id,
          versionNumber: promptVersions.versionNumber,
          text: promptVersions.text,
          usedAt: promptVersions.usedAt,
        })
        .from(promptVersions)
        .where(eq(promptVersions.projectId, projectId))
        .orderBy(desc(promptVersions.versionNumber))
        .limit(1)

      const decision = decideTextSave(latest ?? null, targetVersionId, parsed.text)
      if (decision.mode === 'stale') {
        stale = true
        return
      }
      if (decision.mode === 'unchanged') return

      if (decision.mode === 'update') {
        await tx
          .update(promptVersions)
          .set({ text: parsed.text, updatedAt: sql`now()` })
          .where(eq(promptVersions.id, decision.versionId))
        return
      }

      await tx.insert(promptVersions).values({
        projectId,
        versionNumber: decision.versionNumber,
        text: parsed.text,
        createdBy: userId,
      })
    })
  } catch (err) {
    if (pgErrorCode(err) === '23505') return { error: PROMPT_RACED }
    throw err
  }

  if (stale) return { error: PROMPT_STALE }

  revalidatePath(`/projects/${projectId}/prompt`)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, nonce: Date.now() }
}

export type PromptMetadataState =
  | { error: string }
  | { ok: true; nonce: number }
  | null

const METADATA_DENIED =
  'Não foi possível salvar os dados do prompt. Apenas o administrador do projeto pode editá-los.'

const METADATA_STALE =
  'Só a versão mais recente do prompt aceita nome, descrição e registro de mudanças. Recarregue a página para continuar da versão atual.'

type MetadataField = {
  field: keyof PromptMetadata
  input: string
  max: number
  label: string
}

const METADATA_FIELDS: MetadataField[] = [
  { field: 'name', input: 'name', max: PROMPT_NAME_MAX, label: 'O nome do prompt' },
  {
    field: 'description',
    input: 'description',
    max: PROMPT_DESCRIPTION_MAX,
    label: 'A descrição do prompt',
  },
  {
    field: 'changeLog',
    input: 'change_log',
    max: PROMPT_CHANGE_LOG_MAX,
    label: 'O registro de mudanças',
  },
]

function parsePromptMetadata(
  formData: FormData,
): { error: string } | { metadata: PromptMetadata } {
  const metadata: PromptMetadata = { name: null, description: null, changeLog: null }

  for (const { field, input, max, label } of METADATA_FIELDS) {
    const value = String(formData.get(input) ?? '')
      .replace(/\r\n/g, '\n')
      .trim()
    if (value.length > max) {
      return { error: `${label} pode ter no máximo ${max} caracteres.` }
    }
    metadata[field] = value || null
  }

  return { metadata }
}

export async function savePromptMetadata(
  _prev: PromptMetadataState,
  formData: FormData,
): Promise<PromptMetadataState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  const parsed = parsePromptMetadata(formData)
  if ('error' in parsed) return parsed

  if (!(await isProjectAdmin(userId, projectId))) return { error: METADATA_DENIED }

  const targetVersionId = String(formData.get('version_id') ?? '') || null

  let stale = false
  await transaction(async (tx) => {
    await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .for('update')

    const [latest] = await tx
      .select({
        id: promptVersions.id,
        versionNumber: promptVersions.versionNumber,
        usedAt: promptVersions.usedAt,
        name: promptVersions.name,
        description: promptVersions.description,
        changeLog: promptVersions.changeLog,
      })
      .from(promptVersions)
      .where(eq(promptVersions.projectId, projectId))
      .orderBy(desc(promptVersions.versionNumber))
      .limit(1)

    const decision = decideMetadataSave(latest ?? null, targetVersionId)
    if (decision.mode === 'stale') {
      stale = true
      return
    }

    const unchanged = METADATA_FIELDS.every(
      ({ field }) => latest[field] === parsed.metadata[field],
    )
    if (unchanged) return

    await tx
      .update(promptVersions)
      .set({ ...parsed.metadata, updatedAt: sql`now()` })
      .where(eq(promptVersions.id, decision.versionId))
  })

  if (stale) return { error: METADATA_STALE }

  revalidatePath(`/projects/${projectId}/prompt`)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, nonce: Date.now() }
}

export type ItemState = { error: string } | { ok: true; nonce: number } | null

type ParsedItem = { name: string; content: string }

const ITEM_CREATE_DENIED =
  'Não foi possível cadastrar o item. Apenas o administrador do projeto pode cadastrá-lo.'

const ITEM_UPDATE_DENIED =
  'Não foi possível salvar o item. Apenas o administrador do projeto pode editá-lo.'

const ITEM_DELETE_DENIED =
  'Não foi possível remover o item. Apenas o administrador do projeto pode removê-lo.'

const ITEM_USED =
  'Este item já foi usado em uma rodada e não pode mais ser editado nem removido, porque isso mudaria o que os avaliadores viram. Cadastre um item novo com o conteúdo corrigido.'

const ITEM_MISSING =
  'Este item não existe mais neste projeto. Recarregue a página para ver a lista atual.'

function parseItemForm(formData: FormData): { error: string } | ParsedItem {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'O nome do item é obrigatório.' }
  if (name.length > ITEM_NAME_MAX) {
    return { error: `O nome do item pode ter no máximo ${ITEM_NAME_MAX} caracteres.` }
  }

  const content = normalizeItemContent(String(formData.get('content') ?? ''))
  if (!content.trim()) return { error: 'O conteúdo do item é obrigatório.' }
  const tooLong = itemContentError(content)
  if (tooLong) return { error: tooLong }

  return { name, content }
}

export async function createItem(
  _prev: ItemState,
  formData: FormData,
): Promise<ItemState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  const parsed = parseItemForm(formData)
  if ('error' in parsed) return parsed

  if (!(await isProjectAdmin(userId, projectId))) return { error: ITEM_CREATE_DENIED }

  await transaction((tx) =>
    tx.insert(inputItems).values({
      projectId,
      name: parsed.name,
      content: parsed.content,
      createdBy: userId,
    }),
  )

  revalidatePath(`/projects/${projectId}/items`)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, nonce: Date.now() }
}

type ItemOutcome = 'ok' | 'missing' | 'used'

async function withEditableItem(
  projectId: string,
  itemId: string,
  run: (tx: Transaction) => Promise<void>,
): Promise<ItemOutcome> {
  let outcome: ItemOutcome = 'ok'

  await transaction(async (tx) => {
    const [item] = await tx
      .select({ id: inputItems.id, usedAt: inputItems.usedAt })
      .from(inputItems)
      .where(and(eq(inputItems.id, itemId), eq(inputItems.projectId, projectId)))
      .limit(1)
      .for('update')

    if (!item) {
      outcome = 'missing'
      return
    }
    if (isUsed(item)) {
      outcome = 'used'
      return
    }

    await run(tx)
  })

  return outcome
}

function itemOutcomeError(outcome: ItemOutcome): { error: string } | null {
  if (outcome === 'missing') return { error: ITEM_MISSING }
  if (outcome === 'used') return { error: ITEM_USED }
  return null
}

export async function updateItem(
  _prev: ItemState,
  formData: FormData,
): Promise<ItemState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const itemId = String(formData.get('item_id') ?? '')
  if (!projectId || !itemId) return { error: 'Item inválido.' }

  const parsed = parseItemForm(formData)
  if ('error' in parsed) return parsed

  if (!(await isProjectAdmin(userId, projectId))) return { error: ITEM_UPDATE_DENIED }

  const outcome = await withEditableItem(projectId, itemId, (tx) =>
    tx
      .update(inputItems)
      .set({ name: parsed.name, content: parsed.content, updatedAt: sql`now()` })
      .where(eq(inputItems.id, itemId))
      .then(() => undefined),
  )

  const failure = itemOutcomeError(outcome)
  if (failure) return failure

  revalidatePath(`/projects/${projectId}/items`)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, nonce: Date.now() }
}

export async function deleteItem(
  _prev: ItemState,
  formData: FormData,
): Promise<ItemState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const itemId = String(formData.get('item_id') ?? '')
  if (!projectId || !itemId) return { error: 'Item inválido.' }

  if (!(await isProjectAdmin(userId, projectId))) return { error: ITEM_DELETE_DENIED }

  const outcome = await withEditableItem(projectId, itemId, (tx) =>
    tx
      .delete(inputItems)
      .where(eq(inputItems.id, itemId))
      .then(() => undefined),
  )

  const failure = itemOutcomeError(outcome)
  if (failure) return failure

  revalidatePath(`/projects/${projectId}/items`)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, nonce: Date.now() }
}

export type PromptTestState =
  | { error: string }
  | { ok: true; nonce: number; model: string; output: string }
  | null

const TEST_DENIED =
  'Não foi possível testar o prompt. Apenas o administrador do projeto pode testá-lo.'

const TEST_ITEM_MISSING =
  'Escolha um item de entrada deste projeto para o teste. Recarregue a página se a lista estiver desatualizada.'

const TEST_INCOMPLETE =
  'O teste precisa de ao menos uma definição, do texto do prompt e de um item de entrada.'

const TEST_FAILED =
  'Não foi possível obter a resposta da LLM. Tente de novo em alguns instantes.'

const TEST_FAILURE_MESSAGES: Record<LlmFailure, string> = {
  auth:
    'O provedor não aceitou a chave de acesso configurada no servidor. ' +
    'Confira a chave com quem cuida da instalação e teste de novo.',
  model:
    'O provedor não reconheceu o modelo configurado no servidor. ' +
    'Confira o identificador do modelo com quem cuida da instalação e teste de novo.',
  too_large:
    'O item escolhido é grande demais para o modelo. Escolha um item menor, ' +
    'ou reduza o conteúdo do item e o texto do prompt.',
  timeout:
    'A LLM demorou demais para responder e a chamada foi encerrada. ' +
    'Teste de novo, ou escolha um item menor.',
  unavailable:
    'O provedor da LLM está fora do ar ou sobrecarregado agora. ' +
    'Teste de novo em alguns instantes.',
  unknown: TEST_FAILED,
}

function testCeilingReached(max: number): string {
  return (
    `Este projeto atingiu o teto de ${max} respostas de LLM, que existe para o teste ` +
    'não virar fatura. Fale com quem cuida da instalação para revisar o teto.'
  )
}

export async function testPrompt(
  _prev: PromptTestState,
  formData: FormData,
): Promise<PromptTestState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  const itemId = String(formData.get('item_id') ?? '')
  if (!itemId) return { error: TEST_ITEM_MISSING }

  if (!(await isProjectAdmin(userId, projectId))) return { error: TEST_DENIED }

  const { codebook, prompt, item } = await transaction(async (tx) => {
    const [item] = await tx
      .select({ content: inputItems.content })
      .from(inputItems)
      .where(and(eq(inputItems.id, itemId), eq(inputItems.projectId, projectId)))
      .limit(1)

    return {
      codebook: await loadCodebook(projectId, tx),
      prompt: await loadPrompt(projectId, tx),
      item,
    }
  })

  if (!item) return { error: TEST_ITEM_MISSING }

  const promptText = prompt.version?.text ?? ''
  const inputs = {
    definitions: codebook.definitions.length,
    promptText,
    items: 1,
  }
  if (!canAdvanceFromPhase1(inputs)) return { error: TEST_INCOMPLETE }

  if (!hasProjectResponsesLeft(projectId)) {
    return { error: testCeilingReached(projectResponsesMax()) }
  }

  const input = composeLlmInput({
    promptText,
    definitionTitles: codebook.definitions.map((definition) => definition.title),
    itemContent: item.content,
  })

  let answer: LlmAnswer
  try {
    answer = await askLlm(input)
  } catch (cause) {
    return { error: TEST_FAILURE_MESSAGES[llmFailureOf(cause)] }
  }

  countProjectResponse(projectId)
  return { ok: true, nonce: Date.now(), model: answer.model, output: answer.text }
}

export type AdvancePhaseState =
  | { error: string }
  | { ok: true; nonce: number; phase: number }
  | null

const ADVANCE_DENIED =
  'Não foi possível avançar a fase. Apenas o administrador do projeto pode avançá-la.'

const ADVANCE_WRONG_PHASE =
  'Este projeto não está mais na Fase 1, então não há o que avançar aqui. Recarregue a página para ver a fase atual.'

type AdvanceOutcome =
  | { status: 'advanced' }
  | { status: 'denied' }
  | { status: 'wrong_phase' }
  | { status: 'incomplete'; message: string }

export async function advancePhase(
  _prev: AdvancePhaseState,
  formData: FormData,
): Promise<AdvancePhaseState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  if (!(await isProjectAdmin(userId, projectId))) return { error: ADVANCE_DENIED }

  const outcome = await transaction<AdvanceOutcome>(async (tx) => {
    const [project] = await tx
      .select({ id: projects.id, phase: projects.phase })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .for('update')

    if (!project) return { status: 'denied' }
    if (project.phase !== PHASE_1) return { status: 'wrong_phase' }

    const pending = pendingRequirements(await loadPipelineInputs(projectId, tx))
    if (pending.length > 0) {
      return { status: 'incomplete', message: missingInputsMessage(pending) }
    }

    await tx.update(projects).set({ phase: PHASE_2 }).where(eq(projects.id, projectId))
    return { status: 'advanced' }
  })

  if (outcome.status === 'denied') return { error: ADVANCE_DENIED }
  if (outcome.status === 'wrong_phase') return { error: ADVANCE_WRONG_PHASE }
  if (outcome.status === 'incomplete') return { error: outcome.message }

  revalidatePath(`/projects/${projectId}`)
  return { ok: true, nonce: Date.now(), phase: PHASE_2 }
}
