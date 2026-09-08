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

import * as actions from '@/app/projects/[id]/pipeline/actions'
import {
  saveCodebook,
  savePrompt,
  savePromptMetadata,
  createItem,
  updateItem,
  deleteItem,
  advancePhase,
} from '@/app/projects/[id]/pipeline/actions'
import {
  PHASE_1,
  PHASE_2,
  EMPTY_PIPELINE,
  pendingRequirements,
} from '@/app/projects/[id]/pipeline/preconditions'
import { loadPipelineInputs } from '@/app/projects/[id]/pipeline/inputs'
import {
  listCodebookVersions,
  loadCodebook,
} from '@/app/projects/[id]/pipeline/codebook'
import {
  criteriaOfDefinition,
  notesPerResponse,
  resolveCells,
} from '@/app/projects/[id]/pipeline/criteria'
import { loadPrompt } from '@/app/projects/[id]/pipeline/prompt'
import { loadItems } from '@/app/projects/[id]/pipeline/items'
import { composeLlmInput } from '@/app/projects/[id]/pipeline/llm-input'
import {
  readItemFile,
  ITEM_FILE_LIMIT_LABEL,
} from '@/app/projects/[id]/pipeline/item-content'
import {
  ownerDb,
  pgErrorCode,
  projects,
  codebookVersions,
  codebookDefinitions,
  codebookCriteria,
  promptVersions,
  inputItems,
} from '@/lib/db'
import {
  CRITERION_DESCRIPTION_MAX,
  CRITERION_NAME_MAX,
  DEFINITION_DESCRIPTION_MAX,
  ITEM_CONTENT_MAX,
  ITEM_FILE_BYTES_MAX,
  ITEM_NAME_MAX,
  PROMPT_CHANGE_LOG_MAX,
  PROMPT_DESCRIPTION_MAX,
  PROMPT_NAME_MAX,
  PROMPT_TEXT_MAX,
} from '@/lib/limits'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  cleanup,
} from '@/test/helpers'

type DefinitionInput = { title: string; type: string; description?: string }

type CriterionInput = {
  name: string
  scope?: number | 'general'
  description?: string
}

const GERAL: CriterionInput[] = [{ name: 'Clareza', scope: 'general' }]

function fd(
  projectId: string,
  definitions: DefinitionInput[],
  extra: {
    note?: string
    versionId?: string
    criteria?: CriterionInput[]
    rawCriteria?: { names?: string[]; scopes?: string[]; descriptions?: string[] }
  } = {},
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  const withDescriptions = definitions.some((d) => d.description !== undefined)
  for (const definition of definitions) {
    form.append('definition_title', definition.title)
    form.append('definition_type', definition.type)
    if (withDescriptions) {
      form.append('definition_description', definition.description ?? '')
    }
  }

  const criteria = extra.criteria ?? []
  const withCriterionDescriptions = criteria.some((c) => c.description !== undefined)
  for (const criterion of criteria) {
    form.append('criterion_scope', String(criterion.scope ?? 'general'))
    form.append('criterion_name', criterion.name)
    if (withCriterionDescriptions) {
      form.append('criterion_description', criterion.description ?? '')
    }
  }

  for (const name of extra.rawCriteria?.names ?? []) {
    form.append('criterion_name', name)
  }
  for (const scope of extra.rawCriteria?.scopes ?? []) {
    form.append('criterion_scope', scope)
  }
  for (const description of extra.rawCriteria?.descriptions ?? []) {
    form.append('criterion_description', description)
  }

  if (extra.note !== undefined) form.set('note', extra.note)
  if (extra.versionId !== undefined) form.set('version_id', extra.versionId)
  return form
}

function byName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

function criteriaOf(versionId: string) {
  return ownerDb
    .select({
      definitionId: codebookCriteria.definitionId,
      name: codebookCriteria.name,
      description: codebookCriteria.description,
      orderIndex: codebookCriteria.orderIndex,
    })
    .from(codebookCriteria)
    .where(eq(codebookCriteria.codebookVersionId, versionId))
    .orderBy(asc(codebookCriteria.orderIndex))
}

function versionsOf(projectId: string) {
  return ownerDb
    .select({
      id: codebookVersions.id,
      versionNumber: codebookVersions.versionNumber,
      note: codebookVersions.note,
      createdBy: codebookVersions.createdBy,
      createdAt: codebookVersions.createdAt,
      updatedAt: codebookVersions.updatedAt,
      usedAt: codebookVersions.usedAt,
    })
    .from(codebookVersions)
    .where(eq(codebookVersions.projectId, projectId))
    .orderBy(desc(codebookVersions.versionNumber))
}

function definitionsOf(versionId: string) {
  return ownerDb
    .select({
      title: codebookDefinitions.title,
      type: codebookDefinitions.type,
      description: codebookDefinitions.description,
      orderIndex: codebookDefinitions.orderIndex,
    })
    .from(codebookDefinitions)
    .where(eq(codebookDefinitions.codebookVersionId, versionId))
    .orderBy(asc(codebookDefinitions.orderIndex))
}

describe('app/projects/[id]/pipeline/actions — definições salvas de forma versionada', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string): Promise<string> {
    const id = await seedProject(ownerDb, admin)
    projs.push(id)
    return id
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o primeiro salvamento cria a versão 1, com autor, data e a ordem enviada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(project, [
        { title: 'Informacional', type: 'category' },
        { title: 'Transacional', type: 'category' },
      ]),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await versionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].versionNumber).toBe(1)
    expect(versions[0].createdBy).toBe(admin)
    expect(versions[0].createdAt).toBeTruthy()
    expect(versions[0].updatedAt).toBeNull()
    expect(versions[0].usedAt).toBeNull()

    expect(await definitionsOf(versions[0].id)).toEqual([
      { title: 'Informacional', type: 'category', description: null, orderIndex: 0 },
      { title: 'Transacional', type: 'category', description: null, orderIndex: 1 },
    ])
  })

  it('definições de tipos diferentes convivem na mesma versão', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await saveCodebook(
      null,
      fd(project, [
        { title: 'Informacional', type: 'category' },
        { title: 'Clareza', type: 'quality_dimension' },
        { title: 'Tom formal', type: 'guideline' },
      ]),
    )

    const [version] = await versionsOf(project)
    const rows = await definitionsOf(version.id)
    expect(rows.map((r) => r.type)).toEqual(['category', 'quality_dimension', 'guideline'])
  })

  it('salvar numa versão em aberto atualiza a própria versão, sem criar número novo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      note: 'primeira ideia',
      definitions: [{ title: 'Antiga', type: 'category' }],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Nova', type: 'guideline' },
          { title: 'Outra', type: 'category' },
        ],
        { note: 'corrigi o título', versionId },
      ),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await versionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].id).toBe(versionId)
    expect(versions[0].versionNumber).toBe(1)
    expect(versions[0].note).toBe('corrigi o título')
    expect(versions[0].updatedAt).toBeTruthy()

    expect((await definitionsOf(versionId)).map((r) => r.title)).toEqual(['Nova', 'Outra'])
  })

  it('salvar substitui o conjunto inteiro da versão em aberto, sem edição parcial', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'A', type: 'category' },
        { title: 'B', type: 'category' },
        { title: 'C', type: 'category' },
      ],
    })

    auth.userId = admin
    await saveCodebook(null, fd(project, [{ title: 'B', type: 'category' }], { versionId }))

    expect((await definitionsOf(versionId)).map((r) => r.title)).toEqual(['B'])
  })

  it('salvar numa versão congelada por `used_at` cria a seguinte e não altera a antiga', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addCodebookVersion(ownerDb, project, admin, {
      note: 'usada na rodada 1',
      usedAt: new Date().toISOString(),
      definitions: [{ title: 'Congelada', type: 'category' }],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(project, [{ title: 'Depois do congelamento', type: 'guideline' }], {
        note: 'refinei depois da rodada',
        versionId: frozenId,
      }),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await versionsOf(project)
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1])

    const frozen = versions.find((v) => v.id === frozenId)!
    expect(frozen.note).toBe('usada na rodada 1')
    expect(frozen.updatedAt).toBeNull()
    expect(await definitionsOf(frozenId)).toEqual([
      { title: 'Congelada', type: 'category', description: null, orderIndex: 0 },
    ])

    const created = versions.find((v) => v.id !== frozenId)!
    expect(created.note).toBe('refinei depois da rodada')
    expect(created.usedAt).toBeNull()
    expect((await definitionsOf(created.id)).map((r) => r.title)).toEqual([
      'Depois do congelamento',
    ])
  })

  it('a versão nova é a de número imediatamente superior à maior existente', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, { versionNumber: 1 })
    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 7,
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    await saveCodebook(null, fd(project, [{ title: 'Nova', type: 'category' }]))

    const versions = await versionsOf(project)
    expect(versions.map((v) => v.versionNumber)).toEqual([8, 7, 1])
  })

  it('recusa a chamada direta que tenta alterar versão que não é mais a vigente', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const oldId = await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 1,
      definitions: [{ title: 'Velha', type: 'category' }],
    })
    await addCodebookVersion(ownerDb, project, admin, { versionNumber: 2 })

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Invasão', type: 'category' }], { versionId: oldId }),
    )
    expect(denied).toEqual({ error: expect.stringContaining('congelada') })

    expect(await versionsOf(project)).toHaveLength(2)
    expect((await definitionsOf(oldId)).map((r) => r.title)).toEqual(['Velha'])
  })

  it('recusa o salvamento sem nenhuma definição, e nenhuma versão é criada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await saveCodebook(null, fd(project, []))
    expect(denied).toEqual({ error: expect.stringContaining('ao menos uma definição') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('recusa definição sem título ou com tipo inválido, sem gravar nada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const noTitle = await saveCodebook(null, fd(project, [{ title: '   ', type: 'category' }]))
    expect(noTitle).toEqual({ error: expect.stringContaining('título') })

    const badType = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'categoria' }]),
    )
    expect(badType).toEqual({ error: expect.stringContaining('tipo') })

    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('a observação é opcional e fica presa à versão em que foi escrita', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await saveCodebook(null, fd(project, [{ title: 'Sem nota', type: 'category' }]))
    expect(result).toMatchObject({ ok: true })

    const [version] = await versionsOf(project)
    expect(version.note).toBeNull()
  })

  it('o Avaliador é recusado, e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Pirata', type: 'category' }]),
    )
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('o administrador de um projeto não age sobre outro', async () => {
    const admin = await newUser('Admin')
    const outsiderAdmin = await newUser('Admin de Fora')
    const project = await newProject(admin)
    await newProject(outsiderAdmin)

    auth.userId = outsiderAdmin
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Invasão', type: 'category' }]),
    )
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('não existe ação de apagar versão', () => {
    expect(Object.keys(actions)).toEqual([
      'saveCodebook',
      'savePrompt',
      'savePromptMetadata',
      'createItem',
      'updateItem',
      'deleteItem',
      'testPrompt',
      'advancePhase',
    ])
  })

  it('loadCodebook devolve a versão vigente, suas definições e se está em aberto', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    expect(await loadCodebook(project)).toEqual({
      version: null,
      definitions: [],
      criteria: [],
      isOpen: true,
    })

    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 1,
      definitions: [{ title: 'Velha', type: 'category' }],
    })
    const frozenNow = new Date().toISOString()
    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 2,
      definitions: [{ title: 'Vigente', type: 'guideline' }],
      usedAt: frozenNow,
    })

    const codebook = await loadCodebook(project)
    expect(codebook.version?.versionNumber).toBe(2)
    expect(codebook.definitions.map((d) => d.title)).toEqual(['Vigente'])
    expect(codebook.isOpen).toBe(false)
  })
})

function promptFd(
  projectId: string,
  text: string,
  extra: { versionId?: string } = {},
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  form.set('text', text)
  if (extra.versionId !== undefined) form.set('version_id', extra.versionId)
  return form
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
      createdBy: promptVersions.createdBy,
      createdAt: promptVersions.createdAt,
      updatedAt: promptVersions.updatedAt,
      usedAt: promptVersions.usedAt,
    })
    .from(promptVersions)
    .where(eq(promptVersions.projectId, projectId))
    .orderBy(desc(promptVersions.versionNumber))
}

describe('app/projects/[id]/pipeline/actions — texto do prompt salvo de forma versionada', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string): Promise<string> {
    const id = await seedProject(ownerDb, admin)
    projs.push(id)
    return id
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o primeiro salvamento cria a versão 1, com autor e data', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await savePrompt(null, promptFd(project, 'Classifique a consulta.'))
    expect(result).toMatchObject({ ok: true })

    const versions = await promptVersionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].versionNumber).toBe(1)
    expect(versions[0].text).toBe('Classifique a consulta.')
    expect(versions[0].createdBy).toBe(admin)
    expect(versions[0].createdAt).toBeTruthy()
    expect(versions[0].updatedAt).toBeNull()
    expect(versions[0].usedAt).toBeNull()
  })

  it('quebras de linha, linhas em branco e recuos voltam exatamente como foram escritos', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const text = 'Instrução:\n\n    - primeiro recuo\n        - segundo recuo\n\nFim.'

    auth.userId = admin
    await savePrompt(null, promptFd(project, text))

    const [version] = await promptVersionsOf(project)
    expect(version.text).toBe(text)
    expect((await loadPrompt(project)).version?.text).toBe(text)
  })

  it('o CRLF do formulário não vira quebra dupla nem altera o texto guardado', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await savePrompt(null, promptFd(project, 'linha um\r\nlinha dois'))

    const [version] = await promptVersionsOf(project)
    expect(version.text).toBe('linha um\nlinha dois')
  })

  it('texto alterado numa versão em aberto atualiza a própria versão, sem criar número novo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin, {
      text: 'primeira redação',
    })

    auth.userId = admin
    const result = await savePrompt(
      null,
      promptFd(project, 'redação corrigida', { versionId }),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await promptVersionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].id).toBe(versionId)
    expect(versions[0].versionNumber).toBe(1)
    expect(versions[0].text).toBe('redação corrigida')
    expect(versions[0].updatedAt).toBeTruthy()
  })

  it('texto alterado numa versão congelada por `used_at` cria a seguinte e não altera a antiga', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addPromptVersion(ownerDb, project, admin, {
      text: 'usada na rodada 1',
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    const result = await savePrompt(
      null,
      promptFd(project, 'refinei depois da rodada', { versionId: frozenId }),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await promptVersionsOf(project)
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1])

    const frozen = versions.find((v) => v.id === frozenId)!
    expect(frozen.text).toBe('usada na rodada 1')
    expect(frozen.updatedAt).toBeNull()

    const created = versions.find((v) => v.id !== frozenId)!
    expect(created.text).toBe('refinei depois da rodada')
    expect(created.createdBy).toBe(admin)
    expect(created.usedAt).toBeNull()
  })

  it('salvar sem alterar o texto não cria versão nova nem registra alteração', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin, { text: 'igual' })

    auth.userId = admin
    const result = await savePrompt(null, promptFd(project, 'igual', { versionId }))
    expect(result).toMatchObject({ ok: true })

    const versions = await promptVersionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].updatedAt).toBeNull()
  })

  it('salvar o mesmo texto numa versão congelada também não cria versão', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addPromptVersion(ownerDb, project, admin, {
      text: 'igual',
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    const result = await savePrompt(null, promptFd(project, 'igual', { versionId: frozenId }))
    expect(result).toMatchObject({ ok: true })

    expect(await promptVersionsOf(project)).toHaveLength(1)
  })

  it('a versão nova é a de número imediatamente superior à maior existente', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { versionNumber: 1 })
    await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 7,
      text: 'congelada',
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    await savePrompt(null, promptFd(project, 'texto novo'))

    const versions = await promptVersionsOf(project)
    expect(versions.map((v) => v.versionNumber)).toEqual([8, 7, 1])
  })

  it('recusa a chamada direta que tenta alterar versão que não é mais a vigente', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const oldId = await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 1,
      text: 'velha',
    })
    await addPromptVersion(ownerDb, project, admin, { versionNumber: 2, text: 'vigente' })

    auth.userId = admin
    const denied = await savePrompt(null, promptFd(project, 'invasão', { versionId: oldId }))
    expect(denied).toEqual({ error: expect.stringContaining('congelada') })

    const versions = await promptVersionsOf(project)
    expect(versions).toHaveLength(2)
    expect(versions.find((v) => v.id === oldId)!.text).toBe('velha')
  })

  it('recusa texto vazio ou só com espaços, e nenhuma versão é criada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    expect(await savePrompt(null, promptFd(project, ''))).toEqual({
      error: expect.stringContaining('obrigatório'),
    })
    expect(await savePrompt(null, promptFd(project, '   \n\t  '))).toEqual({
      error: expect.stringContaining('obrigatório'),
    })

    expect(await promptVersionsOf(project)).toHaveLength(0)
  })

  it('recusa texto acima do limite de caracteres, sem gravar nada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await savePrompt(null, promptFd(project, 'a'.repeat(PROMPT_TEXT_MAX + 1)))
    expect(denied).toEqual({ error: expect.stringContaining('máximo') })
    expect(await promptVersionsOf(project)).toHaveLength(0)
  })

  it('o Avaliador é recusado, e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const denied = await savePrompt(null, promptFd(project, 'prompt pirata'))
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect(await promptVersionsOf(project)).toHaveLength(0)
  })

  it('o administrador de um projeto não age sobre outro', async () => {
    const admin = await newUser('Admin')
    const outsiderAdmin = await newUser('Admin de Fora')
    const project = await newProject(admin)
    await newProject(outsiderAdmin)

    auth.userId = outsiderAdmin
    const denied = await savePrompt(null, promptFd(project, 'invasão'))
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect(await promptVersionsOf(project)).toHaveLength(0)
  })

  it('o prompt é versionado de forma independente do codebook', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 1,
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    await savePrompt(null, promptFd(project, 'texto'))

    expect((await promptVersionsOf(project)).map((v) => v.versionNumber)).toEqual([1])
    expect((await loadCodebook(project)).version?.versionNumber).toBe(1)
  })

  it('loadPrompt devolve a versão vigente e se ela está em aberto', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    expect(await loadPrompt(project)).toEqual({ version: null, isOpen: true })

    await addPromptVersion(ownerDb, project, admin, { versionNumber: 1, text: 'velha' })
    const prompt = await loadPrompt(project)
    expect(prompt.version?.versionNumber).toBe(1)
    expect(prompt.isOpen).toBe(true)

    await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 2,
      text: 'vigente',
      usedAt: new Date().toISOString(),
    })
    const frozen = await loadPrompt(project)
    expect(frozen.version?.text).toBe('vigente')
    expect(frozen.isOpen).toBe(false)
  })
})

function metadataFd(
  projectId: string,
  fields: {
    name?: string
    description?: string
    changeLog?: string
    versionId?: string
  } = {},
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  if (fields.name !== undefined) form.set('name', fields.name)
  if (fields.description !== undefined) form.set('description', fields.description)
  if (fields.changeLog !== undefined) form.set('change_log', fields.changeLog)
  if (fields.versionId !== undefined) form.set('version_id', fields.versionId)
  return form
}

describe('app/projects/[id]/pipeline/actions — metadados do prompt', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string): Promise<string> {
    const id = await seedProject(ownerDb, admin)
    projs.push(id)
    return id
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('grava nome, descrição e registro de mudanças sem criar versão nova', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin, { text: 'texto' })

    auth.userId = admin
    const result = await savePromptMetadata(
      null,
      metadataFd(project, {
        name: 'instrução direta',
        description: 'pede a categoria e uma justificativa',
        changeLog: 'primeira redação',
        versionId,
      }),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await promptVersionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({
      id: versionId,
      versionNumber: 1,
      text: 'texto',
      name: 'instrução direta',
      description: 'pede a categoria e uma justificativa',
      changeLog: 'primeira redação',
    })
  })

  it('os três campos são opcionais, e o campo vazio é gravado como ausente', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin, {
      name: 'nome antigo',
      description: 'descrição antiga',
      changeLog: 'registro antigo',
    })

    auth.userId = admin
    expect(await savePromptMetadata(null, metadataFd(project, { versionId }))).toMatchObject(
      { ok: true },
    )

    const [version] = await promptVersionsOf(project)
    expect(version.name).toBeNull()
    expect(version.description).toBeNull()
    expect(version.changeLog).toBeNull()
  })

  it('campo só com espaços vira ausente, sem gravar texto em branco', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin)

    auth.userId = admin
    await savePromptMetadata(
      null,
      metadataFd(project, { name: '   ', description: '\n\t ', versionId }),
    )

    const [version] = await promptVersionsOf(project)
    expect(version.name).toBeNull()
    expect(version.description).toBeNull()
  })

  it('a versão mais recente aceita metadado mesmo já congelada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addPromptVersion(ownerDb, project, admin, {
      text: 'congelado',
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    const result = await savePromptMetadata(
      null,
      metadataFd(project, { name: 'usado na rodada piloto', versionId: frozenId }),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await promptVersionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].name).toBe('usado na rodada piloto')
    expect(versions[0].text).toBe('congelado')
    expect(versions[0].usedAt).not.toBeNull()
  })

  it('recusa a chamada direta em versão que não é a mais recente, e nada muda', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const oldId = await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 1,
      text: 'velha',
      name: 'nome da velha',
      usedAt: new Date().toISOString(),
    })
    await addPromptVersion(ownerDb, project, admin, { versionNumber: 2, text: 'vigente' })

    auth.userId = admin
    const denied = await savePromptMetadata(
      null,
      metadataFd(project, { name: 'invasão', versionId: oldId }),
    )
    expect(denied).toEqual({ error: expect.stringContaining('mais recente') })

    const versions = await promptVersionsOf(project)
    expect(versions.find((v) => v.id === oldId)!.name).toBe('nome da velha')
    expect(versions).toHaveLength(2)
  })

  it('recusa a chamada sem versão alvo e o projeto sem nenhuma versão', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { name: 'nome' })
    const empty = await newProject(admin)

    auth.userId = admin
    expect(await savePromptMetadata(null, metadataFd(project, { name: 'sem alvo' }))).toEqual(
      { error: expect.stringContaining('mais recente') },
    )
    expect(
      await savePromptMetadata(null, metadataFd(empty, { name: 'sem versão' })),
    ).toEqual({ error: expect.stringContaining('mais recente') })

    expect((await promptVersionsOf(project))[0].name).toBe('nome')
    expect(await promptVersionsOf(empty)).toHaveLength(0)
  })

  it('salvar sem mudar nada não registra alteração', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin, { name: 'igual' })

    auth.userId = admin
    const result = await savePromptMetadata(
      null,
      metadataFd(project, { name: 'igual', versionId }),
    )
    expect(result).toMatchObject({ ok: true })

    const [version] = await promptVersionsOf(project)
    expect(version.updatedAt).toBeNull()
  })

  it('a edição registra a data da última alteração', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin)

    auth.userId = admin
    await savePromptMetadata(null, metadataFd(project, { name: 'novo nome', versionId }))

    const [version] = await promptVersionsOf(project)
    expect(version.updatedAt).not.toBeNull()
  })

  it('recusa campo acima do limite de caracteres, sem gravar nada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin)

    auth.userId = admin
    const tooLong = [
      metadataFd(project, { name: 'a'.repeat(PROMPT_NAME_MAX + 1), versionId }),
      metadataFd(project, {
        description: 'a'.repeat(PROMPT_DESCRIPTION_MAX + 1),
        versionId,
      }),
      metadataFd(project, {
        changeLog: 'a'.repeat(PROMPT_CHANGE_LOG_MAX + 1),
        versionId,
      }),
    ]
    for (const form of tooLong) {
      expect(await savePromptMetadata(null, form)).toEqual({
        error: expect.stringContaining('máximo'),
      })
    }

    const [version] = await promptVersionsOf(project)
    expect(version.name).toBeNull()
    expect(version.description).toBeNull()
    expect(version.changeLog).toBeNull()
  })

  it('o Avaliador é recusado, e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const versionId = await addPromptVersion(ownerDb, project, admin)

    auth.userId = evaluator
    const denied = await savePromptMetadata(
      null,
      metadataFd(project, { name: 'pirata', versionId }),
    )
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect((await promptVersionsOf(project))[0].name).toBeNull()
  })

  it('o administrador de um projeto não age sobre outro', async () => {
    const admin = await newUser('Admin')
    const outsiderAdmin = await newUser('Admin de Fora')
    const project = await newProject(admin)
    await newProject(outsiderAdmin)
    const versionId = await addPromptVersion(ownerDb, project, admin)

    auth.userId = outsiderAdmin
    const denied = await savePromptMetadata(
      null,
      metadataFd(project, { name: 'invasão', versionId }),
    )
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect((await promptVersionsOf(project))[0].name).toBeNull()
  })

  it('o texto que cria a versão seguinte não herda os metadados da anterior', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, {
      text: 'congelado',
      name: 'nome da versão 1',
      changeLog: 'registro da versão 1',
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    await savePrompt(null, promptFd(project, 'texto novo'))

    const [current, previous] = await promptVersionsOf(project)
    expect(current.versionNumber).toBe(2)
    expect(current.name).toBeNull()
    expect(current.changeLog).toBeNull()
    expect(previous.name).toBe('nome da versão 1')
  })

  it('loadPrompt devolve os metadados junto da versão vigente', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, {
      name: 'instrução direta',
      description: 'descrição',
      changeLog: 'registro',
    })

    const prompt = await loadPrompt(project)
    expect(prompt.version).toMatchObject({
      name: 'instrução direta',
      description: 'descrição',
      changeLog: 'registro',
    })
  })
})

function itemFd(
  projectId: string,
  fields: { name?: string; content?: string; itemId?: string } = {},
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  if (fields.name !== undefined) form.set('name', fields.name)
  if (fields.content !== undefined) form.set('content', fields.content)
  if (fields.itemId !== undefined) form.set('item_id', fields.itemId)
  return form
}

function itemsOf(projectId: string) {
  return ownerDb
    .select({
      id: inputItems.id,
      name: inputItems.name,
      content: inputItems.content,
      createdBy: inputItems.createdBy,
      createdAt: inputItems.createdAt,
      updatedAt: inputItems.updatedAt,
      usedAt: inputItems.usedAt,
    })
    .from(inputItems)
    .where(eq(inputItems.projectId, projectId))
    .orderBy(asc(inputItems.createdAt))
}

describe('app/projects/[id]/pipeline/actions — itens de entrada no pool do projeto', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string, opts: { phase?: number } = {}): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste', opts)
    projs.push(id)
    return id
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('cadastra o item com nome, conteúdo e autor, e ele aparece na lista do projeto', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await createItem(
      null,
      itemFd(project, { name: 'Consulta 001', content: 'como fazer bolo de cenoura' }),
    )
    expect(result).toMatchObject({ ok: true })

    const items = await itemsOf(project)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      name: 'Consulta 001',
      content: 'como fazer bolo de cenoura',
      createdBy: admin,
      updatedAt: null,
      usedAt: null,
    })

    const loaded = await loadItems(project)
    expect(loaded.map((i) => i.name)).toEqual(['Consulta 001'])
    expect(loaded[0].isEditable).toBe(true)
  })

  it('grava o conteúdo colado como está, com a formatação preservada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const content = 'linha 1\n\n    linha 3 recuada\n\ttabulada\n'

    auth.userId = admin
    await createItem(null, itemFd(project, { name: 'Com formatação', content }))

    expect((await itemsOf(project))[0].content).toBe(content)
  })

  it('normaliza CRLF do navegador para quebra de linha simples', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await createItem(null, itemFd(project, { name: 'Do Windows', content: 'a\r\nb\r\nc' }))

    expect((await itemsOf(project))[0].content).toBe('a\nb\nc')
  })

  it('aceita muitos itens no mesmo projeto, sem limite artificial de quantidade', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    for (let i = 1; i <= 12; i++) {
      const ok = await createItem(
        null,
        itemFd(project, { name: `Item ${i}`, content: `conteúdo ${i}` }),
      )
      expect(ok).toMatchObject({ ok: true })
    }

    expect(await itemsOf(project)).toHaveLength(12)
  })

  it('o item pertence ao projeto e continua disponível quando a fase muda', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await createItem(null, itemFd(project, { name: 'Sobrevivente', content: 'conteúdo' }))
    await ownerDb.update(projects).set({ phase: 2 }).where(eq(projects.id, project))

    const loaded = await loadItems(project)
    expect(loaded.map((i) => i.name)).toEqual(['Sobrevivente'])
  })

  it('o pool de um projeto não enxerga o item de outro', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const other = await newProject(admin)

    auth.userId = admin
    await createItem(null, itemFd(project, { name: 'Do primeiro', content: 'conteúdo' }))

    expect((await loadItems(project)).map((i) => i.name)).toEqual(['Do primeiro'])
    expect(await loadItems(other)).toEqual([])
  })

  it('recusa cadastro sem nome ou sem conteúdo, e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    expect(await createItem(null, itemFd(project, { name: '  ', content: 'conteúdo' }))).toEqual(
      { error: expect.stringContaining('nome') },
    )
    expect(await createItem(null, itemFd(project, { name: 'Item', content: ' \n\t ' }))).toEqual(
      { error: expect.stringContaining('conteúdo') },
    )
    expect(await createItem(null, itemFd(project, { name: 'Item' }))).toEqual({
      error: expect.stringContaining('conteúdo'),
    })

    expect(await itemsOf(project)).toHaveLength(0)
  })

  it('recusa conteúdo acima do limite de caracteres, sem gravar nem parcialmente', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await createItem(
      null,
      itemFd(project, { name: 'Gigante', content: 'a'.repeat(ITEM_CONTENT_MAX + 1) }),
    )
    expect(denied).toEqual({ error: expect.stringContaining(String(ITEM_CONTENT_MAX)) })
    expect(denied).toEqual({ error: expect.stringContaining(String(ITEM_CONTENT_MAX + 1)) })
    expect(await itemsOf(project)).toHaveLength(0)
  })

  it('recusa nome acima do limite de caracteres', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await createItem(
      null,
      itemFd(project, { name: 'a'.repeat(ITEM_NAME_MAX + 1), content: 'conteúdo' }),
    )
    expect(denied).toEqual({ error: expect.stringContaining('máximo') })
    expect(await itemsOf(project)).toHaveLength(0)
  })

  it('edita o item nunca usado, registrando a data da alteração', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const item = await addInputItem(ownerDb, project, admin, {
      name: 'Nome velho',
      content: 'conteúdo velho',
    })

    auth.userId = admin
    const result = await updateItem(
      null,
      itemFd(project, { itemId: item, name: 'Nome novo', content: 'conteúdo novo' }),
    )
    expect(result).toMatchObject({ ok: true })

    const [saved] = await itemsOf(project)
    expect(saved).toMatchObject({ name: 'Nome novo', content: 'conteúdo novo' })
    expect(saved.updatedAt).not.toBeNull()
  })

  it('remove o item nunca usado', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const item = await addInputItem(ownerDb, project, admin, { name: 'Descartável' })
    await addInputItem(ownerDb, project, admin, { name: 'Fica' })

    auth.userId = admin
    const result = await deleteItem(null, itemFd(project, { itemId: item }))
    expect(result).toMatchObject({ ok: true })

    expect((await itemsOf(project)).map((i) => i.name)).toEqual(['Fica'])
  })

  it('recusa editar e remover item já usado em rodada, e explica o motivo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const item = await addInputItem(ownerDb, project, admin, {
      name: 'Já usado',
      content: 'conteúdo original',
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    const editDenied = await updateItem(
      null,
      itemFd(project, { itemId: item, name: 'Invasão', content: 'outro conteúdo' }),
    )
    expect(editDenied).toEqual({ error: expect.stringContaining('rodada') })

    const deleteDenied = await deleteItem(null, itemFd(project, { itemId: item }))
    expect(deleteDenied).toEqual({ error: expect.stringContaining('rodada') })

    const [intact] = await itemsOf(project)
    expect(intact).toMatchObject({ name: 'Já usado', content: 'conteúdo original' })
  })

  it('a checagem de uso do item é a mesma que congela a versão de codebook e de prompt', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const usedAt = new Date().toISOString()
    await addInputItem(ownerDb, project, admin, { name: 'Livre' })
    await addInputItem(ownerDb, project, admin, { name: 'Usado', usedAt })
    await addCodebookVersion(ownerDb, project, admin, { versionNumber: 1, usedAt })
    await addPromptVersion(ownerDb, project, admin, { versionNumber: 1, usedAt })

    const items = await loadItems(project)
    expect(items.map((i) => [i.name, i.isEditable])).toEqual([
      ['Livre', true],
      ['Usado', false],
    ])
    expect((await loadCodebook(project)).isOpen).toBe(false)
    expect((await loadPrompt(project)).isOpen).toBe(false)
  })

  it('recusa editar e remover item que não é daquele projeto', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const other = await newProject(admin)
    const item = await addInputItem(ownerDb, other, admin, { name: 'De outro projeto' })

    auth.userId = admin
    expect(await updateItem(null, itemFd(project, { itemId: item, name: 'x', content: 'y' })))
      .toEqual({ error: expect.stringContaining('não existe') })
    expect(await deleteItem(null, itemFd(project, { itemId: item }))).toEqual({
      error: expect.stringContaining('não existe'),
    })

    expect((await itemsOf(other)).map((i) => i.name)).toEqual(['De outro projeto'])
  })

  it('o Avaliador é recusado em cadastrar, editar e remover, e nada muda', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const item = await addInputItem(ownerDb, project, admin, {
      name: 'Do admin',
      content: 'conteúdo do admin',
    })

    auth.userId = evaluator
    expect(await createItem(null, itemFd(project, { name: 'Pirata', content: 'x' }))).toEqual({
      error: expect.stringContaining('administrador'),
    })
    expect(
      await updateItem(null, itemFd(project, { itemId: item, name: 'Pirata', content: 'x' })),
    ).toEqual({ error: expect.stringContaining('administrador') })
    expect(await deleteItem(null, itemFd(project, { itemId: item }))).toEqual({
      error: expect.stringContaining('administrador'),
    })

    const items = await itemsOf(project)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ name: 'Do admin', content: 'conteúdo do admin' })
  })

  it('o administrador de um projeto não age sobre o item de outro', async () => {
    const admin = await newUser('Admin')
    const outsiderAdmin = await newUser('Admin de Fora')
    const project = await newProject(admin)
    await newProject(outsiderAdmin)
    const item = await addInputItem(ownerDb, project, admin, { name: 'Alheio' })

    auth.userId = outsiderAdmin
    expect(await createItem(null, itemFd(project, { name: 'Invasão', content: 'x' }))).toEqual({
      error: expect.stringContaining('administrador'),
    })
    expect(
      await updateItem(null, itemFd(project, { itemId: item, name: 'Invasão', content: 'x' })),
    ).toEqual({ error: expect.stringContaining('administrador') })
    expect(await deleteItem(null, itemFd(project, { itemId: item }))).toEqual({
      error: expect.stringContaining('administrador'),
    })

    expect((await itemsOf(project)).map((i) => i.name)).toEqual(['Alheio'])
  })

  it('loadItems devolve o pool na ordem de cadastro, com o conteúdo inteiro', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    expect(await loadItems(project)).toEqual([])

    auth.userId = admin
    await createItem(null, itemFd(project, { name: 'Primeiro', content: 'linha 1\nlinha 2' }))
    await createItem(null, itemFd(project, { name: 'Segundo', content: 'outro' }))

    const items = await loadItems(project)
    expect(items.map((i) => i.name)).toEqual(['Primeiro', 'Segundo'])
    expect(items[0].content).toBe('linha 1\nlinha 2')
  })
})

describe('app/projects/[id]/pipeline/actions — item cadastrado a partir de arquivo', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste')
    projs.push(id)
    return id
  }

  function textFile(name: string, content: string): File {
    return new File([content], name, { type: 'text/plain' })
  }

  function binaryFile(name: string, bytes: number[]): File {
    return new File([new Uint8Array(bytes)], name, { type: 'application/octet-stream' })
  }

  async function readText(file: File): Promise<string> {
    const result = await readItemFile(file)
    if ('error' in result) throw new Error(`esperava texto, veio erro: ${result.error}`)
    return result.text
  }

  async function readError(file: File): Promise<string> {
    const result = await readItemFile(file)
    if ('text' in result) throw new Error('esperava recusa, veio texto')
    return result.error
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('cadastra o item com o texto lido do arquivo, preservando a formatação', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const content = '# Consulta\n\n    linha recuada\n\tlinha tabulada\n'

    const text = await readText(textFile('consulta.md', content))
    expect(text).toBe(content)

    auth.userId = admin
    const result = await createItem(null, itemFd(project, { name: 'Do arquivo', content: text }))
    expect(result).toMatchObject({ ok: true })

    const items = await itemsOf(project)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ name: 'Do arquivo', content, createdBy: admin })
  })

  it('normaliza CRLF e descarta o BOM do arquivo antes de gravar', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    const text = await readText(textFile('windows.txt', '\uFEFFa\r\nb\r\nc'))
    expect(text).toBe('a\nb\nc')

    auth.userId = admin
    await createItem(null, itemFd(project, { name: 'Do Windows', content: text }))

    expect((await itemsOf(project))[0].content).toBe('a\nb\nc')
  })

  it('aceita os formatos de texto da lista e arquivos de código, não só .txt', async () => {
    const nomes = [
      'notas.txt',
      'leia.md',
      'planilha.csv',
      'tabela.tsv',
      'dados.json',
      'feed.xml',
      'pagina.html',
      'config.yaml',
      'servidor.log',
      'script.py',
      'modulo.ts',
      'consulta.sql',
    ]

    for (const nome of nomes) {
      expect(await readText(textFile(nome, `conteúdo de ${nome}`))).toBe(
        `conteúdo de ${nome}`,
      )
    }
  })

  it('aceita a extensão sem depender do caixa alto do nome do arquivo', async () => {
    expect(await readText(textFile('NOTAS.TXT', 'conteúdo'))).toBe('conteúdo')
  })

  it('recusa formato fora da lista de permissão, mesmo não sendo imagem nem vídeo', async () => {
    for (const nome of ['foto.png', 'video.mp4', 'audio.mp3', 'pacote.zip', 'app.exe']) {
      expect(await readError(textFile(nome, 'qualquer coisa'))).toContain('não é aceito')
    }
  })

  it('recusa arquivo sem extensão, porque a aceitação é por lista de permissão', async () => {
    expect(await readError(textFile('README', 'conteúdo'))).toContain('não é aceito')
    expect(await readError(textFile('.gitignore', 'node_modules'))).toContain('não é aceito')
  })

  it('recusa PDF e Word com mensagem dizendo para exportar como texto', async () => {
    for (const nome of ['artigo.pdf', 'carta.doc', 'carta.docx']) {
      const erro = await readError(textFile(nome, 'conteúdo'))
      expect(erro).toContain('PDF e Word')
      expect(erro).toContain('exporte o conteúdo como texto')
    }
  })

  it('recusa arquivo com extensão aceita que não decodifica como texto', async () => {
    const invalido = await readError(binaryFile('disfarcado.txt', [0xff, 0xfe, 0xc3, 0x28]))
    expect(invalido).toContain('binário')

    const comNulo = await readError(binaryFile('disfarcado.csv', [0x41, 0x00, 0x42]))
    expect(comNulo).toContain('binário')
  })

  it('recusa arquivo acima do limite de bytes, com a mensagem do arquivo', async () => {
    const grande = new File(
      [new Uint8Array(ITEM_FILE_BYTES_MAX + 1)],
      'grande.txt',
      { type: 'text/plain' },
    )
    const erro = await readError(grande)
    expect(erro).toContain('2,1 MB')
    expect(erro).toContain(`o limite é ${ITEM_FILE_LIMIT_LABEL}`)
    expect(erro).not.toContain(String(ITEM_CONTENT_MAX))
  })

  it('recusa arquivo dentro dos bytes que gere texto acima do limite de caracteres, com a mensagem do conteúdo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    const conteudo = 'a'.repeat(ITEM_CONTENT_MAX + 1)
    expect(conteudo.length).toBeLessThan(ITEM_FILE_BYTES_MAX)

    const erro = await readError(textFile('longo.txt', conteudo))
    expect(erro).toContain(String(ITEM_CONTENT_MAX))
    expect(erro).toContain(String(ITEM_CONTENT_MAX + 1))
    expect(erro).not.toContain('MB')

    auth.userId = admin
    expect(await itemsOf(project)).toHaveLength(0)
  })

  it('aplica o limite de caracteres igual para texto digitado e texto vindo de arquivo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const conteudo = 'a'.repeat(ITEM_CONTENT_MAX + 1)

    const doArquivo = await readError(textFile('longo.txt', conteudo))

    auth.userId = admin
    const digitado = await createItem(
      null,
      itemFd(project, { name: 'Gigante', content: conteudo }),
    )

    expect(digitado).toEqual({ error: doArquivo })
    expect(await itemsOf(project)).toHaveLength(0)
  })

  it('o item recusado no arquivo não é gravado nem parcialmente', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    await readError(binaryFile('disfarcado.txt', [0xff, 0xfe, 0xc3, 0x28]))
    await readError(textFile('foto.png', 'conteúdo'))

    auth.userId = admin
    expect(await itemsOf(project)).toHaveLength(0)
    expect(await loadItems(project)).toEqual([])
  })

  it('aceita exatamente o limite de caracteres vindo de arquivo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    const text = await readText(textFile('limite.txt', 'a'.repeat(ITEM_CONTENT_MAX)))

    auth.userId = admin
    expect(await createItem(null, itemFd(project, { name: 'No limite', content: text }))).toMatchObject({
      ok: true,
    })
    expect((await itemsOf(project))[0].content).toHaveLength(ITEM_CONTENT_MAX)
  })
})

describe('app/projects/[id]/pipeline/actions — ordenação das definições', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string): Promise<string> {
    const id = await seedProject(ownerDb, admin)
    projs.push(id)
    return id
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('a ordem enviada é a ordem gravada, numerada a partir de zero', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await saveCodebook(
      null,
      fd(project, [
        { title: 'Terceira', type: 'category' },
        { title: 'Primeira', type: 'category' },
        { title: 'Segunda', type: 'category' },
      ]),
    )

    const [version] = await versionsOf(project)
    expect(await definitionsOf(version.id)).toEqual([
      { title: 'Terceira', type: 'category', description: null, orderIndex: 0 },
      { title: 'Primeira', type: 'category', description: null, orderIndex: 1 },
      { title: 'Segunda', type: 'category', description: null, orderIndex: 2 },
    ])
  })

  it('reordenar numa versão em aberto não cria versão nova', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'A', type: 'category' },
        { title: 'B', type: 'category' },
        { title: 'C', type: 'category' },
      ],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'C', type: 'category' },
          { title: 'A', type: 'category' },
          { title: 'B', type: 'category' },
        ],
        { versionId },
      ),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await versionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].id).toBe(versionId)
    expect((await definitionsOf(versionId)).map((r) => r.title)).toEqual(['C', 'A', 'B'])
  })

  it('a ordem da versão congelada não é alterada: a nova ordem vai para a versão seguinte', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        { title: 'A', type: 'category' },
        { title: 'B', type: 'category' },
      ],
    })

    auth.userId = admin
    await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'B', type: 'category' },
          { title: 'A', type: 'category' },
        ],
        { versionId: frozenId },
      ),
    )

    expect((await definitionsOf(frozenId)).map((r) => r.title)).toEqual(['A', 'B'])

    const versions = await versionsOf(project)
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1])
    const created = versions.find((v) => v.id !== frozenId)!
    expect((await definitionsOf(created.id)).map((r) => r.title)).toEqual(['B', 'A'])
  })

  it('recusa reordenar uma versão que não é mais a vigente, fora da interface', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const oldId = await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 1,
      usedAt: new Date().toISOString(),
      definitions: [
        { title: 'A', type: 'category' },
        { title: 'B', type: 'category' },
      ],
    })
    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 2,
      definitions: [{ title: 'Vigente', type: 'category' }],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'B', type: 'category' },
          { title: 'A', type: 'category' },
        ],
        { versionId: oldId },
      ),
    )
    expect(result).toMatchObject({ error: expect.stringContaining('versão vigente') })

    expect((await definitionsOf(oldId)).map((r) => r.title)).toEqual(['A', 'B'])
    expect((await versionsOf(project)).map((v) => v.versionNumber)).toEqual([2, 1])
  })

  it('cada versão guarda a própria ordem, e loadCodebook devolve a da vigente', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        { title: 'A', type: 'category' },
        { title: 'B', type: 'category' },
      ],
    })

    auth.userId = admin
    await saveCodebook(
      null,
      fd(project, [
        { title: 'B', type: 'category' },
        { title: 'A', type: 'category' },
      ]),
    )

    expect((await definitionsOf(frozenId)).map((r) => r.title)).toEqual(['A', 'B'])

    const codebook = await loadCodebook(project)
    expect(codebook.definitions.map((d) => d.title)).toEqual(['B', 'A'])
    expect(codebook.definitions.map((d) => d.orderIndex)).toEqual([0, 1])
  })

  it('a ordem salva é a que vai no envio à LLM', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await saveCodebook(
      null,
      fd(project, [
        { title: 'Transacional', type: 'category' },
        { title: 'Informacional', type: 'category' },
      ]),
    )

    const codebook = await loadCodebook(project)
    const input = composeLlmInput({
      promptText: 'Classifique a consulta.',
      definitionTitles: codebook.definitions.map((d) => d.title),
      itemContent: 'como trocar pneu',
    })
    expect(input.indexOf('Transacional')).toBeLessThan(input.indexOf('Informacional'))
  })
})

describe('app/projects/[id]/pipeline/actions — avanço da Fase 1 para a Fase 2', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string, phase?: number): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
    projs.push(id)
    return id
  }

  async function phaseOf(projectId: string): Promise<number> {
    const [row] = await ownerDb
      .select({ phase: projects.phase })
      .from(projects)
      .where(eq(projects.id, projectId))
    return row.phase
  }

  function advanceFd(projectId: string): FormData {
    const form = new FormData()
    form.set('project_id', projectId)
    return form
  }

  async function seedInputs(
    projectId: string,
    admin: string,
    skip: 'definition' | 'prompt' | 'item' | null = null,
  ): Promise<void> {
    if (skip !== 'definition') await addCodebookVersion(ownerDb, projectId, admin)
    if (skip !== 'prompt') {
      await addPromptVersion(ownerDb, projectId, admin, { text: 'Classifique a consulta.' })
    }
    if (skip !== 'item') await addInputItem(ownerDb, projectId, admin)
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('com os três insumos, o Administrador avança o projeto para a Fase 2', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await seedInputs(project, admin)

    auth.userId = admin
    expect(await phaseOf(project)).toBe(PHASE_1)

    const result = await advancePhase(null, advanceFd(project))
    expect(result).toMatchObject({ ok: true, phase: PHASE_2 })
    expect(await phaseOf(project)).toBe(PHASE_2)
  })

  it('avançar não congela nenhuma versão de codebook nem de prompt', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await seedInputs(project, admin)

    auth.userId = admin
    await advancePhase(null, advanceFd(project))

    const codebook = await loadCodebook(project)
    const prompt = await loadPrompt(project)
    expect(codebook.version?.usedAt).toBeNull()
    expect(codebook.isOpen).toBe(true)
    expect(prompt.version?.usedAt).toBeNull()
    expect(prompt.isOpen).toBe(true)

    const [item] = await loadItems(project)
    expect(item.usedAt).toBeNull()
    expect(item.isEditable).toBe(true)
  })

  it('a configuração continua editável depois do avanço', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await seedInputs(project, admin)

    auth.userId = admin
    await advancePhase(null, advanceFd(project))

    const saved = await savePrompt(null, promptFd(project, 'Classifique de novo.'))
    expect(saved).toMatchObject({ ok: true })
  })

  it.each([
    ['definition', 'definição'],
    ['prompt', 'texto do prompt'],
    ['item', 'item de entrada'],
  ] as const)(
    'recusa o avanço sem %s, nomeando o insumo que falta, e a fase não muda',
    async (skip, nome) => {
      const admin = await newUser('Admin')
      const project = await newProject(admin)
      await seedInputs(project, admin, skip)

      auth.userId = admin
      const denied = await advancePhase(null, advanceFd(project))
      expect(denied).toEqual({ error: expect.stringContaining(nome) })
      expect(await phaseOf(project)).toBe(PHASE_1)
    },
  )

  it('recusa a chamada direta feita fora da interface, com o motivo, no projeto vazio', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await advancePhase(null, advanceFd(project))
    expect(denied).toEqual({
      error: expect.stringContaining('definição, texto do prompt e item de entrada'),
    })
    expect(await phaseOf(project)).toBe(PHASE_1)
  })

  it('a trava é só por insumo faltando: nenhuma métrica participa da decisão', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await seedInputs(project, admin)

    auth.userId = admin
    const inputs = await loadPipelineInputs(project)
    expect(Object.keys(inputs).sort()).toEqual(Object.keys(EMPTY_PIPELINE).sort())
    expect(pendingRequirements(inputs)).toEqual([])
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({ ok: true })
  })

  it('o Avaliador é recusado, e a fase não muda', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await seedInputs(project, admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const denied = await advancePhase(null, advanceFd(project))
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect(await phaseOf(project)).toBe(PHASE_1)
  })

  it('o administrador de um projeto não avança outro', async () => {
    const admin = await newUser('Admin')
    const outsiderAdmin = await newUser('Admin de Fora')
    const project = await newProject(admin)
    await seedInputs(project, admin)
    await newProject(outsiderAdmin)

    auth.userId = outsiderAdmin
    const denied = await advancePhase(null, advanceFd(project))
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect(await phaseOf(project)).toBe(PHASE_1)
  })

  it('a recusa não distingue projeto existente de inexistente', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)
    await seedInputs(project, admin)

    auth.userId = outsider
    const existing = await advancePhase(null, advanceFd(project))
    const missing = await advancePhase(null, advanceFd(crypto.randomUUID()))
    expect(existing).toEqual(missing)
  })

  it('recusa avançar um projeto que já saiu da Fase 1, e a fase não muda', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    await seedInputs(project, admin)

    auth.userId = admin
    const denied = await advancePhase(null, advanceFd(project))
    expect(denied).toEqual({ error: expect.stringContaining('Fase 1') })
    expect(await phaseOf(project)).toBe(PHASE_2)
  })

  it('um segundo avanço seguido não empurra o projeto para a Fase 3', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await seedInputs(project, admin)

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({ ok: true })
    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: expect.any(String),
    })
    expect(await phaseOf(project)).toBe(PHASE_2)
  })

  it('recusa a chamada sem projeto', async () => {
    const admin = await newUser('Admin')

    auth.userId = admin
    expect(await advancePhase(null, new FormData())).toEqual({
      error: expect.any(String),
    })
  })
})

describe('app/projects/[id]/pipeline/actions — descrição das definições', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string, phase = PHASE_2): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
    projs.push(id)
    return id
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('a descrição é gravada junto da definição a que pertence', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(project, [
        {
          title: 'Informacional',
          type: 'category',
          description: 'busca informação, sem intenção de compra',
        },
        { title: 'Transacional', type: 'category', description: 'quer concluir uma ação' },
      ], { criteria: GERAL }),
    )
    expect(result).toMatchObject({ ok: true })

    const [version] = await versionsOf(project)
    expect(await definitionsOf(version.id)).toEqual([
      {
        title: 'Informacional',
        type: 'category',
        description: 'busca informação, sem intenção de compra',
        orderIndex: 0,
      },
      {
        title: 'Transacional',
        type: 'category',
        description: 'quer concluir uma ação',
        orderIndex: 1,
      },
    ])
  })

  it('a descrição é opcional: salvar sem ela é permitido e grava nulo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(project, [
        { title: 'Sem descrição', type: 'category', description: '' },
        { title: 'Só espaços', type: 'category', description: '   ' },
      ], { criteria: GERAL }),
    )
    expect(result).toMatchObject({ ok: true })

    const [version] = await versionsOf(project)
    expect((await definitionsOf(version.id)).map((d) => d.description)).toEqual([
      null,
      null,
    ])
  })

  it('escrever a descrição numa versão em aberto atualiza no lugar, sem número novo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [{ title: 'Informacional', type: 'category' }],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          {
            title: 'Informacional',
            type: 'category',
            description: 'descrição escrita na Fase 2',
          },
        ],
        { versionId, criteria: GERAL },
      ),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await versionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].id).toBe(versionId)
    expect(versions[0].versionNumber).toBe(1)
    expect((await definitionsOf(versionId)).map((d) => d.description)).toEqual([
      'descrição escrita na Fase 2',
    ])
  })

  it('escrever a descrição numa versão congelada cria a seguinte e não altera a anterior', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        { title: 'Informacional', type: 'category', description: 'descrição antiga' },
      ],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          {
            title: 'Informacional',
            type: 'category',
            description: 'descrição refinada depois da rodada',
          },
        ],
        { versionId: frozenId, criteria: GERAL },
      ),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await versionsOf(project)
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1])

    expect(await definitionsOf(frozenId)).toEqual([
      {
        title: 'Informacional',
        type: 'category',
        description: 'descrição antiga',
        orderIndex: 0,
      },
    ])

    const created = versions.find((v) => v.id !== frozenId)!
    expect((await definitionsOf(created.id)).map((d) => d.description)).toEqual([
      'descrição refinada depois da rodada',
    ])
  })

  it('recusa a descrição acima do limite, e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(project, [
        {
          title: 'Informacional',
          type: 'category',
          description: 'a'.repeat(DEFINITION_DESCRIPTION_MAX + 1),
        },
      ]),
    )
    expect(denied).toEqual({ error: expect.stringContaining('descrição') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('aceita a descrição no limite exato', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(project, [
        {
          title: 'Informacional',
          type: 'category',
          description: 'a'.repeat(DEFINITION_DESCRIPTION_MAX),
        },
      ], { criteria: GERAL }),
    )
    expect(result).toMatchObject({ ok: true })

    const [version] = await versionsOf(project)
    expect((await definitionsOf(version.id))[0].description).toHaveLength(
      DEFINITION_DESCRIPTION_MAX,
    )
  })

  it('o banco recusa a descrição acima do limite, mesmo por escrita direta', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [],
    })

    const rejected = await ownerDb
      .insert(codebookDefinitions)
      .values({
        codebookVersionId: versionId,
        title: 'Informacional',
        type: 'category',
        description: 'a'.repeat(DEFINITION_DESCRIPTION_MAX + 1),
        orderIndex: 0,
      })
      .catch((err: unknown) => err)

    expect(pgErrorCode(rejected)).toBe('23514')
  })

  it('o Avaliador é recusado, e nenhuma descrição é gravada', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [{ title: 'Informacional', type: 'category' }],
    })

    auth.userId = evaluator
    const denied = await saveCodebook(
      null,
      fd(
        project,
        [{ title: 'Informacional', type: 'category', description: 'escrita do avaliador' }],
        { versionId },
      ),
    )
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect((await definitionsOf(versionId)).map((d) => d.description)).toEqual([null])
  })

  it('um formulário sem os campos de descrição salva as definições com descrição nula', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(project, [
        { title: 'Informacional', type: 'category' },
        { title: 'Transacional', type: 'category' },
      ], { criteria: GERAL }),
    )
    expect(result).toMatchObject({ ok: true })

    const [version] = await versionsOf(project)
    expect((await definitionsOf(version.id)).map((d) => d.description)).toEqual([
      null,
      null,
    ])
  })

  it('recusa o envio com um número de descrições diferente do de definições', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    const form = fd(project, [
      { title: 'Informacional', type: 'category', description: 'uma' },
      { title: 'Transacional', type: 'category', description: 'duas' },
    ])
    form.append('definition_description', 'sobrando')

    auth.userId = admin
    const denied = await saveCodebook(null, form)
    expect(denied).toEqual({ error: expect.stringContaining('ler as definições') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('loadCodebook devolve a descrição junto de cada definição', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category', description: 'com descrição' },
        { title: 'Transacional', type: 'category' },
      ],
    })

    const codebook = await loadCodebook(project)
    expect(codebook.definitions.map((d) => d.description)).toEqual([
      'com descrição',
      null,
    ])
  })

  it('recusa a descrição enquanto o projeto está na Fase 1, e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_1)

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(project, [
        {
          title: 'Informacional',
          type: 'category',
          description: 'descrição escrita cedo demais',
        },
      ]),
    )
    expect(denied).toEqual({ error: expect.stringContaining('Fase 2') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('a recusa na Fase 1 não toca a versão em aberto que já existe', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_1)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      note: 'antes da tentativa',
      definitions: [{ title: 'Informacional', type: 'category' }],
    })

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(
        project,
        [{ title: 'Renomeada', type: 'guideline', description: 'cedo demais' }],
        { note: 'depois da tentativa', versionId },
      ),
    )
    expect(denied).toEqual({ error: expect.stringContaining('Fase 2') })

    const versions = await versionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].note).toBe('antes da tentativa')
    expect(await definitionsOf(versionId)).toEqual([
      { title: 'Informacional', type: 'category', description: null, orderIndex: 0 },
    ])
  })

  it('na Fase 1, campos de descrição vazios não contam como descrição e o salvamento passa', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_1)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(project, [
        { title: 'Informacional', type: 'category', description: '' },
        { title: 'Transacional', type: 'category', description: '   ' },
      ]),
    )
    expect(result).toMatchObject({ ok: true })

    const [version] = await versionsOf(project)
    expect((await definitionsOf(version.id)).map((d) => d.description)).toEqual([
      null,
      null,
    ])
  })
})

describe('app/projects/[id]/pipeline/actions — critérios do codebook', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string, phase = PHASE_2): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
    projs.push(id)
    return id
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o critério específico nasce ligado à definição a que pertence', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
        ],
        {
          criteria: [
            { name: 'Cita a fonte', scope: 0, description: 'a fonte é verificável' },
            { name: 'Indica o preço', scope: 1 },
          ],
        },
      ),
    )
    expect(result).toMatchObject({ ok: true })

    const [version] = await versionsOf(project)
    const definitions = await ownerDb
      .select({ id: codebookDefinitions.id, title: codebookDefinitions.title })
      .from(codebookDefinitions)
      .where(eq(codebookDefinitions.codebookVersionId, version.id))
      .orderBy(asc(codebookDefinitions.orderIndex))

    const criteria = await criteriaOf(version.id)
    expect(byName(criteria)).toEqual([
      {
        definitionId: definitions[0].id,
        name: 'Cita a fonte',
        description: 'a fonte é verificável',
        orderIndex: 0,
      },
      {
        definitionId: definitions[1].id,
        name: 'Indica o preço',
        description: null,
        orderIndex: 0,
      },
    ])
  })

  it('o critério geral nasce sem vínculo com definição nenhuma', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [{ name: 'Clareza', scope: 'general' }],
      }),
    )

    const [version] = await versionsOf(project)
    expect(await criteriaOf(version.id)).toEqual([
      { definitionId: null, name: 'Clareza', description: null, orderIndex: 0 },
    ])
  })

  it('o critério geral é lido dentro de cada definição, e o específico só na sua', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
        ],
        {
          criteria: [
            { name: 'Cita a fonte', scope: 0 },
            { name: 'Clareza', scope: 'general' },
          ],
        },
      ),
    )

    const codebook = await loadCodebook(project)
    const cells = resolveCells(codebook.definitions, codebook.criteria)

    expect(
      cells.map((cell) => [cell.definition.title, cell.criterion.name, cell.isGeneral]),
    ).toEqual([
      ['Informacional', 'Cita a fonte', false],
      ['Informacional', 'Clareza', true],
      ['Transacional', 'Clareza', true],
    ])
  })

  it('a ordem dos critérios dentro da definição é a ordem enviada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [
          { name: 'Terceiro', scope: 0 },
          { name: 'Primeiro', scope: 0 },
          { name: 'Segundo', scope: 0 },
        ],
      }),
    )

    const [version] = await versionsOf(project)
    const criteria = await criteriaOf(version.id)
    expect(criteria.map((c) => [c.name, c.orderIndex])).toEqual([
      ['Terceiro', 0],
      ['Primeiro', 1],
      ['Segundo', 2],
    ])

    const codebook = await loadCodebook(project)
    expect(
      criteriaOfDefinition(codebook.definitions[0].id, codebook.criteria).map(
        (c) => c.name,
      ),
    ).toEqual(['Terceiro', 'Primeiro', 'Segundo'])
  })

  it('cada definição numera os próprios critérios a partir de zero', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
        ],
        {
          criteria: [
            { name: 'A', scope: 0 },
            { name: 'B', scope: 0 },
            { name: 'C', scope: 1 },
            { name: 'Geral', scope: 'general' },
          ],
        },
      ),
    )

    const [version] = await versionsOf(project)
    expect(byName(await criteriaOf(version.id)).map((c) => [c.name, c.orderIndex])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 0],
      ['Geral', 0],
    ])
  })

  it('editar o critério geral numa versão em aberto vale para todas as definições de uma vez', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category' },
        { title: 'Transacional', type: 'category' },
      ],
      generalCriteria: [{ name: 'Clareza' }],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
        ],
        { versionId, criteria: [{ name: 'Clareza da regra', scope: 'general' }] },
      ),
    )
    expect(result).toMatchObject({ ok: true })

    expect(await versionsOf(project)).toHaveLength(1)
    const codebook = await loadCodebook(project)
    expect(codebook.criteria.map((c) => c.name)).toEqual(['Clareza da regra'])
    expect(
      codebook.definitions.map(
        (definition) =>
          criteriaOfDefinition(definition.id, codebook.criteria).map((c) => c.name),
      ),
    ).toEqual([['Clareza da regra'], ['Clareza da regra']])
  })

  it('remover o critério geral remove de todas as definições de uma vez', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Cita a fonte' }] },
        { title: 'Transacional', type: 'category', criteria: [{ name: 'Indica o preço' }] },
      ],
      generalCriteria: [{ name: 'Clareza' }],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
        ],
        {
          versionId,
          criteria: [
            { name: 'Cita a fonte', scope: 0 },
            { name: 'Indica o preço', scope: 1 },
          ],
        },
      ),
    )
    expect(result).toMatchObject({ ok: true })

    const codebook = await loadCodebook(project)
    expect(byName(codebook.criteria).map((c) => c.name)).toEqual([
      'Cita a fonte',
      'Indica o preço',
    ])
    expect(codebook.criteria.every((c) => c.definitionId !== null)).toBe(true)
  })

  it('reordenar critérios numa versão em aberto não cria versão nova', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        {
          title: 'Informacional',
          type: 'category',
          criteria: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        },
      ],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        versionId,
        criteria: [
          { name: 'C', scope: 0 },
          { name: 'A', scope: 0 },
          { name: 'B', scope: 0 },
        ],
      }),
    )
    expect(result).toMatchObject({ ok: true })

    const versions = await versionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].id).toBe(versionId)
    expect((await criteriaOf(versionId)).map((c) => c.name)).toEqual(['C', 'A', 'B'])
  })

  it('alterar critério em versão congelada cria a seguinte, copiando definições e critérios', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        {
          title: 'Informacional',
          type: 'category',
          description: 'busca informação',
          criteria: [{ name: 'Cita a fonte' }],
        },
        { title: 'Transacional', type: 'category' },
      ],
      generalCriteria: [{ name: 'Clareza' }],
    })

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category', description: 'busca informação' },
          { title: 'Transacional', type: 'category', description: '' },
        ],
        {
          versionId: frozenId,
          criteria: [
            { name: 'Cita a fonte', scope: 0 },
            { name: 'Verifica a data', scope: 0 },
            { name: 'Clareza', scope: 'general' },
          ],
        },
      ),
    )
    expect(result).toMatchObject({ ok: true })

    expect(byName(await criteriaOf(frozenId)).map((c) => c.name)).toEqual([
      'Cita a fonte',
      'Clareza',
    ])
    expect((await definitionsOf(frozenId)).map((d) => d.title)).toEqual([
      'Informacional',
      'Transacional',
    ])

    const versions = await versionsOf(project)
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1])

    const created = versions.find((v) => v.id !== frozenId)!
    expect((await definitionsOf(created.id)).map((d) => d.title)).toEqual([
      'Informacional',
      'Transacional',
    ])
    expect(byName(await criteriaOf(created.id)).map((c) => c.name)).toEqual([
      'Cita a fonte',
      'Clareza',
      'Verifica a data',
    ])

    const codebook = await loadCodebook(project)
    expect(
      criteriaOfDefinition(codebook.definitions[0].id, codebook.criteria).map(
        (c) => c.name,
      ),
    ).toEqual(['Cita a fonte', 'Verifica a data', 'Clareza'])
  })

  it('o critério da versão nova aponta para a definição da versão nova, não a da anterior', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Cita a fonte' }] },
      ],
    })

    auth.userId = admin
    await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        versionId: frozenId,
        criteria: [{ name: 'Cita a fonte', scope: 0 }],
      }),
    )

    const created = (await versionsOf(project)).find((v) => v.id !== frozenId)!
    const [definition] = await ownerDb
      .select({ id: codebookDefinitions.id })
      .from(codebookDefinitions)
      .where(eq(codebookDefinitions.codebookVersionId, created.id))

    const [criterion] = await criteriaOf(created.id)
    expect(criterion.definitionId).toBe(definition.id)
  })

  it('recusa salvar com uma definição sem nenhum critério, nomeando a definição', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
        ],
        { criteria: [{ name: 'Cita a fonte', scope: 0 }] },
      ),
    )

    expect(denied).toEqual({ error: expect.stringContaining('“Transacional”') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('a recusa nomeia todas as definições sem critério e não toca a versão em aberto', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      note: 'antes da tentativa',
      definitions: [{ title: 'Informacional', type: 'category' }],
      generalCriteria: [{ name: 'Clareza' }],
    })

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
        ],
        { versionId, note: 'depois da tentativa' },
      ),
    )

    expect(denied).toEqual({
      error: expect.stringContaining('“Informacional” e “Transacional”'),
    })

    const versions = await versionsOf(project)
    expect(versions).toHaveLength(1)
    expect(versions[0].note).toBe('antes da tentativa')
    expect((await criteriaOf(versionId)).map((c) => c.name)).toEqual(['Clareza'])
  })

  it('um único critério geral cobre todas as definições e o salvamento passa', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
          { title: 'Navegacional', type: 'category' },
        ],
        { criteria: [{ name: 'Clareza', scope: 'general' }] },
      ),
    )
    expect(result).toMatchObject({ ok: true })

    const [version] = await versionsOf(project)
    expect(await criteriaOf(version.id)).toHaveLength(1)
  })

  it('recusa critério sem nome, e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [{ name: '   ', scope: 0 }],
      }),
    )

    expect(denied).toEqual({ error: expect.stringContaining('nome') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('recusa nome de critério acima do limite, sem gravar nada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [{ name: 'a'.repeat(CRITERION_NAME_MAX + 1), scope: 0 }],
      }),
    )

    expect(denied).toEqual({
      error: expect.stringContaining(String(CRITERION_NAME_MAX)),
    })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('recusa descrição de critério acima do limite, e aceita o limite exato', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [
          {
            name: 'Cita a fonte',
            scope: 0,
            description: 'a'.repeat(CRITERION_DESCRIPTION_MAX + 1),
          },
        ],
      }),
    )
    expect(denied).toEqual({
      error: expect.stringContaining(String(CRITERION_DESCRIPTION_MAX)),
    })
    expect(await versionsOf(project)).toHaveLength(0)

    const result = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [
          {
            name: 'Cita a fonte',
            scope: 0,
            description: 'a'.repeat(CRITERION_DESCRIPTION_MAX),
          },
        ],
      }),
    )
    expect(result).toMatchObject({ ok: true })
  })

  it('o banco recusa o nome de critério acima do limite, mesmo por escrita direta', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin)

    const write = ownerDb.insert(codebookCriteria).values({
      codebookVersionId: versionId,
      definitionId: null,
      name: 'a'.repeat(CRITERION_NAME_MAX + 1),
      orderIndex: 0,
    })

    await expect(write).rejects.toSatisfy(
      (err: unknown) => pgErrorCode(err) === '23514',
    )
  })

  it('recusa a chamada direta com critério fora das definições enviadas', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [{ name: 'Cita a fonte', scope: 7 }],
      }),
    )

    expect(denied).toEqual({ error: expect.stringContaining('definição') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('recusa o envio com número de nomes e de vínculos diferentes', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        rawCriteria: { names: ['Cita a fonte', 'Clareza'], scopes: ['0'] },
      }),
    )

    expect(denied).toEqual({ error: expect.stringContaining('ler os critérios') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('recusa criar critério enquanto o projeto está na Fase 1, e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_1)

    auth.userId = admin
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [{ name: 'Cita a fonte', scope: 0 }],
      }),
    )

    expect(denied).toEqual({ error: expect.stringContaining('Fase 2') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('na Fase 1, salvar definição sem critério continua permitido', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_1)

    auth.userId = admin
    const result = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }]),
    )

    expect(result).toMatchObject({ ok: true })
    const [version] = await versionsOf(project)
    expect(await criteriaOf(version.id)).toEqual([])
  })

  it('o Avaliador é recusado, e nenhum critério é gravado', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [{ name: 'Cita a fonte', scope: 0 }],
      }),
    )

    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('o administrador de um projeto não cria critério em outro', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('Admin de Outro')
    const project = await newProject(admin)
    await newProject(outsider)

    auth.userId = outsider
    const denied = await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [{ name: 'Cita a fonte', scope: 0 }],
      }),
    )

    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect(await versionsOf(project)).toHaveLength(0)
  })

  it('a conta de notas por resposta acompanha os critérios criados e removidos', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
        ],
        {
          criteria: [
            { name: 'Cita a fonte', scope: 0 },
            { name: 'Clareza', scope: 'general' },
          ],
        },
      ),
    )

    const before = await loadCodebook(project)
    expect(notesPerResponse(before.definitions, before.criteria)).toBe(3)

    await saveCodebook(
      null,
      fd(
        project,
        [
          { title: 'Informacional', type: 'category' },
          { title: 'Transacional', type: 'category' },
        ],
        {
          versionId: before.version!.id,
          criteria: [{ name: 'Clareza', scope: 'general' }],
        },
      ),
    )

    const after = await loadCodebook(project)
    expect(notesPerResponse(after.definitions, after.criteria)).toBe(2)
  })

  it('o histórico traz a contagem de definições e de critérios de cada versão', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 1,
      usedAt: new Date().toISOString(),
      definitions: [{ title: 'Informacional', type: 'category' }],
      generalCriteria: [{ name: 'Clareza' }],
    })
    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 2,
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Cita a fonte' }] },
        { title: 'Transacional', type: 'category' },
      ],
      generalCriteria: [{ name: 'Clareza' }, { name: 'Objetividade' }],
    })

    const versions = await listCodebookVersions(project)
    expect(
      versions.map((v) => [v.versionNumber, v.definitionCount, v.criterionCount]),
    ).toEqual([
      [2, 2, 3],
      [1, 1, 1],
    ])
  })

  it('a versão sem definição nenhuma aparece no histórico com contagem zero', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, { definitions: [] })

    const [version] = await listCodebookVersions(project)
    expect([version.definitionCount, version.criterionCount]).toEqual([0, 0])
  })

  it('nenhum critério vai no envio à LLM, que continua só com prompt e títulos', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await saveCodebook(
      null,
      fd(project, [{ title: 'Informacional', type: 'category' }], {
        criteria: [
          { name: 'Cita a fonte', scope: 0, description: 'a fonte é verificável' },
        ],
      }),
    )

    const codebook = await loadCodebook(project)
    const input = composeLlmInput({
      promptText: 'Classifique a consulta.',
      definitionTitles: codebook.definitions.map((d) => d.title),
      itemContent: 'como trocar pneu',
    })

    expect(input).toContain('Informacional')
    expect(input).not.toContain('Cita a fonte')
    expect(input).not.toContain('a fonte é verificável')
  })
})
