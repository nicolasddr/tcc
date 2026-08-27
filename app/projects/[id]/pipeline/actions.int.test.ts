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
  createItem,
  updateItem,
  deleteItem,
} from '@/app/projects/[id]/pipeline/actions'
import { loadCodebook } from '@/app/projects/[id]/pipeline/codebook'
import { loadPrompt } from '@/app/projects/[id]/pipeline/prompt'
import { loadItems } from '@/app/projects/[id]/pipeline/items'
import { composeLlmInput } from '@/app/projects/[id]/pipeline/llm-input'
import {
  ownerDb,
  projects,
  codebookVersions,
  codebookDefinitions,
  promptVersions,
  inputItems,
} from '@/lib/db'
import { ITEM_CONTENT_MAX, ITEM_NAME_MAX, PROMPT_TEXT_MAX } from '@/lib/limits'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  cleanup,
} from '@/test/helpers'

type DefinitionInput = { title: string; type: string }

function fd(
  projectId: string,
  definitions: DefinitionInput[],
  extra: { note?: string; versionId?: string } = {},
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  for (const definition of definitions) {
    form.append('definition_title', definition.title)
    form.append('definition_type', definition.type)
  }
  if (extra.note !== undefined) form.set('note', extra.note)
  if (extra.versionId !== undefined) form.set('version_id', extra.versionId)
  return form
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
      'createItem',
      'updateItem',
      'deleteItem',
      'testPrompt',
    ])
  })

  it('loadCodebook devolve a versão vigente, suas definições e se está em aberto', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    expect(await loadCodebook(project)).toEqual({
      version: null,
      definitions: [],
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
