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
import { saveCodebook } from '@/app/projects/[id]/pipeline/actions'
import { loadCodebook } from '@/app/projects/[id]/pipeline/codebook'
import { ownerDb, codebookVersions, codebookDefinitions } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
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
    expect(Object.keys(actions)).toEqual(['saveCodebook'])
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
