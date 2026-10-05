import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { asc, desc, eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import {
  saveCodebook,
  savePrompt,
  savePromptMetadata,
  createItem,
  updateItem,
  deleteItem,
} from '@/app/projects/[id]/pipeline/actions'
import { frozenMessage } from '@/app/projects/[id]/pipeline/freeze'
import { PHASE_2, PHASE_3, PHASE_4 } from '@/app/projects/[id]/pipeline/preconditions'
import { codebookLockedMessage } from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import {
  ownerDb,
  codebookVersions,
  codebookDefinitions,
  codebookCriteria,
  promptVersions,
  inputItems,
} from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  cleanup,
} from '@/test/helpers'

const PROMPT_TEXT = 'Classifique a consulta de busca abaixo.'

const DEFINITIONS = [
  {
    title: 'Navegacional',
    type: 'category',
    description: 'Busca chegar a um site.',
    criteria: [{ name: 'Destino', description: 'Cita um site específico.' }],
  },
  {
    title: 'Informacional',
    type: 'category',
    description: 'Busca aprender algo.',
    criteria: [{ name: 'Pergunta', description: 'Formula uma dúvida.' }],
  },
]

type DefinitionInput = {
  title: string
  description: string
  criterion: string
  criterionDescription: string
}

const SAVED: DefinitionInput[] = DEFINITIONS.map((definition) => ({
  title: definition.title,
  description: definition.description,
  criterion: definition.criteria[0].name,
  criterionDescription: definition.criteria[0].description,
}))

function codebookForm(
  projectId: string,
  definitions: DefinitionInput[],
  versionId?: string,
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  definitions.forEach((definition, index) => {
    form.append('definition_title', definition.title)
    form.append('definition_type', 'category')
    form.append('definition_description', definition.description)
    form.append('criterion_scope', String(index))
    form.append('criterion_name', definition.criterion)
    form.append('criterion_description', definition.criterionDescription)
  })
  if (versionId !== undefined) form.set('version_id', versionId)
  return form
}

const CODEBOOK_CHANGES: [string, DefinitionInput[]][] = [
  ['uma definição nova', [...SAVED, { ...SAVED[0], title: 'Transacional' }]],
  ['só a descrição', [{ ...SAVED[0], description: 'Outra descrição.' }, SAVED[1]]],
  ['só um critério', [SAVED[0], { ...SAVED[1], criterion: 'Outro critério' }]],
  ['só a ordem', [SAVED[1], SAVED[0]]],
]

function promptForm(projectId: string, text: string, versionId?: string): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  form.set('text', text)
  if (versionId !== undefined) form.set('version_id', versionId)
  return form
}

function metadataForm(
  projectId: string,
  versionId: string,
  fields: { name: string; description: string; changeLog: string },
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  form.set('version_id', versionId)
  form.set('name', fields.name)
  form.set('description', fields.description)
  form.set('change_log', fields.changeLog)
  return form
}

function itemForm(
  projectId: string,
  fields: { itemId?: string; name?: string; content?: string },
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  if (fields.itemId !== undefined) form.set('item_id', fields.itemId)
  if (fields.name !== undefined) form.set('name', fields.name)
  if (fields.content !== undefined) form.set('content', fields.content)
  return form
}

async function codebookSnapshot(projectId: string) {
  const versions = await ownerDb
    .select({
      id: codebookVersions.id,
      versionNumber: codebookVersions.versionNumber,
      note: codebookVersions.note,
      updatedAt: codebookVersions.updatedAt,
      usedAt: codebookVersions.usedAt,
    })
    .from(codebookVersions)
    .where(eq(codebookVersions.projectId, projectId))
    .orderBy(desc(codebookVersions.versionNumber))

  const contents = await Promise.all(
    versions.map(async (version) => ({
      definitions: await ownerDb
        .select({
          id: codebookDefinitions.id,
          title: codebookDefinitions.title,
          type: codebookDefinitions.type,
          description: codebookDefinitions.description,
          orderIndex: codebookDefinitions.orderIndex,
        })
        .from(codebookDefinitions)
        .where(eq(codebookDefinitions.codebookVersionId, version.id))
        .orderBy(asc(codebookDefinitions.orderIndex)),
      criteria: await ownerDb
        .select({
          id: codebookCriteria.id,
          definitionId: codebookCriteria.definitionId,
          name: codebookCriteria.name,
          description: codebookCriteria.description,
          orderIndex: codebookCriteria.orderIndex,
        })
        .from(codebookCriteria)
        .where(eq(codebookCriteria.codebookVersionId, version.id))
        .orderBy(asc(codebookCriteria.orderIndex), asc(codebookCriteria.name)),
    })),
  )

  return { versions, contents }
}

function promptVersionsOf(projectId: string) {
  return ownerDb
    .select({
      id: promptVersions.id,
      versionNumber: promptVersions.versionNumber,
      text: promptVersions.text,
      name: promptVersions.name,
      description: promptVersions.description,
      changeLog: promptVersions.changeLog,
      updatedAt: promptVersions.updatedAt,
      usedAt: promptVersions.usedAt,
    })
    .from(promptVersions)
    .where(eq(promptVersions.projectId, projectId))
    .orderBy(desc(promptVersions.versionNumber))
}

function itemsOf(projectId: string) {
  return ownerDb
    .select({
      id: inputItems.id,
      name: inputItems.name,
      content: inputItems.content,
      updatedAt: inputItems.updatedAt,
      usedAt: inputItems.usedAt,
    })
    .from(inputItems)
    .where(eq(inputItems.projectId, projectId))
    .orderBy(asc(inputItems.createdAt))
}

describe('app/projects/[id]/pipeline/actions — Fase 4 congela codebook e texto do prompt', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function advancedProject(
    admin: string,
    opts: { phase?: number; used?: boolean } = {},
  ): Promise<{ project: string; codebookVersion: string; promptVersion: string }> {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: opts.phase ?? PHASE_4,
    })
    projs.push(project)
    const usedAt = opts.used === false ? null : '2026-09-01T12:00:00.000Z'
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      usedAt,
      definitions: DEFINITIONS,
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin, {
      text: PROMPT_TEXT,
      usedAt,
    })
    if (usedAt !== null) {
      await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
        roundNumber: 1,
        status: 'closed',
        phase: PHASE_3,
      })
    }
    return { project, codebookVersion, promptVersion }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it.each(CODEBOOK_CHANGES)(
    'salvar o codebook com %s é recusado, e o banco fica igual',
    async (_label, definitions) => {
      const admin = await newUser('Admin')
      const { project, codebookVersion } = await advancedProject(admin)
      const before = await codebookSnapshot(project)

      auth.userId = admin
      const result = await saveCodebook(null, codebookForm(project, definitions, codebookVersion))

      expect(result).toEqual({ error: frozenMessage('codebook') })
      expect(await codebookSnapshot(project)).toEqual(before)
    },
  )

  it('com a vigente em aberto, a recusa vale igual e a versão não é atualizada no lugar', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion } = await advancedProject(admin, { used: false })
    const before = await codebookSnapshot(project)
    expect(before.versions[0].usedAt).toBeNull()

    auth.userId = admin
    const result = await saveCodebook(
      null,
      codebookForm(project, CODEBOOK_CHANGES[1][1], codebookVersion),
    )

    expect(result).toEqual({ error: frozenMessage('codebook') })
    const after = await codebookSnapshot(project)
    expect(after).toEqual(before)
    expect(after.versions[0].updatedAt).toBeNull()
  })

  it('com rodada aberta na Fase 4, a recusa é a do congelamento, não a da rodada', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await advancedProject(admin)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 2,
      phase: PHASE_4,
    })
    const before = await codebookSnapshot(project)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      codebookForm(project, CODEBOOK_CHANGES[0][1], codebookVersion),
    )

    expect(result).toEqual({ error: frozenMessage('codebook') })
    expect(result).not.toEqual({ error: codebookLockedMessage(2) })
    expect(await codebookSnapshot(project)).toEqual(before)
  })

  it('o Avaliador recebe a recusa de papel, não a de fase', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const { project, codebookVersion, promptVersion } = await advancedProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const codebookBefore = await codebookSnapshot(project)
    const promptBefore = await promptVersionsOf(project)

    auth.userId = evaluator
    const codebook = await saveCodebook(
      null,
      codebookForm(project, CODEBOOK_CHANGES[0][1], codebookVersion),
    )
    const prompt = await savePrompt(null, promptForm(project, 'Texto novo.', promptVersion))

    expect(codebook).toEqual({ error: expect.stringContaining('Apenas o administrador') })
    expect(codebook).not.toEqual({ error: frozenMessage('codebook') })
    expect(prompt).toEqual({ error: expect.stringContaining('Apenas o administrador') })
    expect(prompt).not.toEqual({ error: frozenMessage('prompt') })
    expect(await codebookSnapshot(project)).toEqual(codebookBefore)
    expect(await promptVersionsOf(project)).toEqual(promptBefore)
  })

  it('salvar texto novo do prompt é recusado, e versões, texto e data ficam iguais', async () => {
    const admin = await newUser('Admin')
    const { project, promptVersion } = await advancedProject(admin)
    const before = await promptVersionsOf(project)

    auth.userId = admin
    const result = await savePrompt(null, promptForm(project, 'Texto novo.', promptVersion))

    expect(result).toEqual({ error: frozenMessage('prompt') })
    expect(await promptVersionsOf(project)).toEqual(before)
  })

  it('salvar o mesmo texto do prompt também é recusado, e nada muda', async () => {
    const admin = await newUser('Admin')
    const { project, promptVersion } = await advancedProject(admin)
    const before = await promptVersionsOf(project)

    auth.userId = admin
    const result = await savePrompt(null, promptForm(project, PROMPT_TEXT, promptVersion))

    expect(result).toEqual({ error: frozenMessage('prompt') })
    expect(await promptVersionsOf(project)).toEqual(before)
  })

  it('com a vigente do prompt em aberto, a recusa vale igual e o texto não é atualizado no lugar', async () => {
    const admin = await newUser('Admin')
    const { project, promptVersion } = await advancedProject(admin, { used: false })
    const before = await promptVersionsOf(project)

    auth.userId = admin
    const result = await savePrompt(null, promptForm(project, 'Texto novo.', promptVersion))

    expect(result).toEqual({ error: frozenMessage('prompt') })
    expect(await promptVersionsOf(project)).toEqual(before)
  })

  it('salvar os metadados do prompt funciona, na vigente e sem versão nova', async () => {
    const admin = await newUser('Admin')
    const { project, promptVersion } = await advancedProject(admin)

    auth.userId = admin
    const result = await savePromptMetadata(
      null,
      metadataForm(project, promptVersion, {
        name: 'Prompt da replicação',
        description: 'Versão avaliada na Fase 3.',
        changeLog: 'Sem mudanças no texto.',
      }),
    )

    expect(result).toMatchObject({ ok: true })
    const versions = await promptVersionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({
      id: promptVersion,
      text: PROMPT_TEXT,
      name: 'Prompt da replicação',
      description: 'Versão avaliada na Fase 3.',
      changeLog: 'Sem mudanças no texto.',
    })
    expect(versions[0].usedAt).not.toBeNull()
  })

  it('cadastrar item funciona, e o item aparece no pool', async () => {
    const admin = await newUser('Admin')
    const { project } = await advancedProject(admin)

    auth.userId = admin
    const result = await createItem(
      null,
      itemForm(project, { name: 'Consulta nova', content: 'preço do ingresso' }),
    )

    expect(result).toMatchObject({ ok: true })
    expect(await itemsOf(project)).toEqual([
      expect.objectContaining({
        name: 'Consulta nova',
        content: 'preço do ingresso',
        usedAt: null,
      }),
    ])
  })

  it('item não usado continua editável e removível', async () => {
    const admin = await newUser('Admin')
    const { project } = await advancedProject(admin)
    const edited = await addInputItem(ownerDb, project, admin, { name: 'Antes' })
    const removed = await addInputItem(ownerDb, project, admin, { name: 'Descartável' })

    auth.userId = admin
    expect(
      await updateItem(
        null,
        itemForm(project, { itemId: edited, name: 'Depois', content: 'conteúdo novo' }),
      ),
    ).toMatchObject({ ok: true })
    expect(await deleteItem(null, itemForm(project, { itemId: removed }))).toMatchObject({
      ok: true,
    })

    const items = await itemsOf(project)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: edited, name: 'Depois', content: 'conteúdo novo' })
    expect(items[0].updatedAt).not.toBeNull()
  })

  it('item usado continua recusado em editar e remover, com a mesma mensagem das outras fases', async () => {
    const admin = await newUser('Admin')
    const usedAt = new Date().toISOString()
    const { project } = await advancedProject(admin)
    const item = await addInputItem(ownerDb, project, admin, {
      name: 'Já usado',
      content: 'conteúdo original',
      usedAt,
    })
    const { project: earlier } = await advancedProject(admin, { phase: PHASE_2 })
    const earlierItem = await addInputItem(ownerDb, earlier, admin, { usedAt })

    auth.userId = admin
    const editedEarlier = await updateItem(
      null,
      itemForm(earlier, { itemId: earlierItem, name: 'Outro', content: 'outro' }),
    )
    const removedEarlier = await deleteItem(null, itemForm(earlier, { itemId: earlierItem }))
    const edited = await updateItem(
      null,
      itemForm(project, { itemId: item, name: 'Outro', content: 'outro' }),
    )
    const removed = await deleteItem(null, itemForm(project, { itemId: item }))

    expect(editedEarlier).toEqual({ error: expect.stringContaining('rodada') })
    expect(edited).toEqual(editedEarlier)
    expect(removed).toEqual(removedEarlier)
    expect(await itemsOf(project)).toEqual([
      expect.objectContaining({ name: 'Já usado', content: 'conteúdo original' }),
    ])
  })
})
