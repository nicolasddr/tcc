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
import { saveCodebook, savePrompt } from '@/app/projects/[id]/pipeline/actions'
import { loadCodebook } from '@/app/projects/[id]/pipeline/codebook'
import { loadPrompt } from '@/app/projects/[id]/pipeline/prompt'
import {
  ownerDb,
  codebookVersions,
  codebookDefinitions,
  promptVersions,
} from '@/lib/db'
import { PROMPT_TEXT_MAX } from '@/lib/limits'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
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
    expect(Object.keys(actions)).toEqual(['saveCodebook', 'savePrompt'])
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
