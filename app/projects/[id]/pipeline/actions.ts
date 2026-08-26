'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq, sql } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import {
  transaction,
  pgErrorCode,
  projects,
  codebookVersions,
  codebookDefinitions,
  promptVersions,
} from '@/lib/db'
import { isProjectAdmin } from '@/lib/authz'
import { decideSave, decideTextSave } from '@/lib/versioning'
import {
  normalizeDefinitionType,
  type DefinitionType,
} from '@/app/projects/definition-types'
import {
  CODEBOOK_NOTE_MAX,
  DEFINITION_TITLE_MAX,
  PROMPT_TEXT_MAX,
} from '@/lib/limits'

export type CodebookState = { error: string } | { ok: true; nonce: number } | null

type ParsedDefinition = { title: string; type: DefinitionType }

type ParsedCodebook = { definitions: ParsedDefinition[]; note: string | null }

const DENIED =
  'Não foi possível salvar as definições. Apenas o administrador do projeto pode editá-las.'

const STALE =
  'Esta não é mais a versão vigente do codebook, e versão congelada não é editável. Recarregue a página para continuar da versão atual.'

const RACED =
  'Outro salvamento criou uma versão ao mesmo tempo. Recarregue a página e salve de novo.'

function parseCodebookForm(formData: FormData): { error: string } | ParsedCodebook {
  const titles = formData.getAll('definition_title').map(String)
  const types = formData.getAll('definition_type').map(String)
  if (titles.length !== types.length) {
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
    definitions.push({ title, type })
  }

  if (definitions.length === 0) {
    return { error: 'É preciso ao menos uma definição para salvar o codebook.' }
  }

  const note = String(formData.get('note') ?? '').trim()
  if (note.length > CODEBOOK_NOTE_MAX) {
    return { error: `A observação pode ter no máximo ${CODEBOOK_NOTE_MAX} caracteres.` }
  }

  return { definitions, note: note || null }
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
        stale = true
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

      await tx.insert(codebookDefinitions).values(
        parsed.definitions.map((definition, index) => ({
          codebookVersionId: versionId,
          title: definition.title,
          type: definition.type,
          orderIndex: index,
        })),
      )
    })
  } catch (err) {
    if (pgErrorCode(err) === '23505') return { error: RACED }
    throw err
  }

  if (stale) return { error: STALE }

  revalidatePath(`/projects/${projectId}/pipeline`)
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

  revalidatePath(`/projects/${projectId}/pipeline`)
  return { ok: true, nonce: Date.now() }
}
