import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { loadEvaluationContext } from '@/app/projects/[id]/(tabs)/evaluate/context'
import { PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  cleanup,
} from '@/test/helpers'

const ABSENT = '00000000-0000-4000-8000-000000000000'

describe('app/projects/[id]/evaluate/context — o que foi pedido à LLM', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function scenario(
    admin: string,
    opts: {
      promptText?: string
      promptName?: string | null
      promptDescription?: string | null
      itemName?: string
      itemContent?: string
    } = {},
  ) {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: PHASE_2,
    })
    projs.push(project)

    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [{ title: 'Informacional', type: 'category', criteria: [] }],
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin, {
      text: opts.promptText ?? 'Classifique a intenção de busca.',
      name: opts.promptName ?? null,
      description: opts.promptDescription ?? null,
    })
    const round = await addRound(ownerDb, project, admin, codebookVersion, promptVersion)
    const item = await addInputItem(ownerDb, project, admin, {
      name: opts.itemName ?? 'como plantar manjericão',
      content: opts.itemContent ?? 'Consulta digitada pelo usuário.',
    })
    const response = await addResponse(ownerDb, round, item, admin)

    return { project, round, response, promptVersion, codebookVersion, item }
  }

  beforeEach(() => {
    users = []
    projs = []
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('traz o prompt e o item de entrada daquela resposta', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      promptText: 'Classifique a intenção de busca.',
      itemName: 'como plantar manjericão',
      itemContent: 'Consulta digitada pelo usuário.',
    })

    const context = await loadEvaluationContext(scene.project, scene.response)

    expect(context).not.toBeNull()
    expect(context!.prompt).toMatchObject({
      versionNumber: 1,
      text: 'Classifique a intenção de busca.',
    })
    expect(context!.item).toEqual({
      name: 'como plantar manjericão',
      content: 'Consulta digitada pelo usuário.',
    })
  })

  it('o nome e a descrição do prompt vêm quando preenchidos, e são nulos quando não', async () => {
    const admin = await newUser('Admin')
    const withMetadata = await scenario(admin, {
      promptName: 'Classificador v1',
      promptDescription: 'Primeira tentativa, sem exemplos.',
    })
    const without = await scenario(admin)

    const filled = await loadEvaluationContext(
      withMetadata.project,
      withMetadata.response,
    )
    expect(filled!.prompt.name).toBe('Classificador v1')
    expect(filled!.prompt.description).toBe('Primeira tentativa, sem exemplos.')

    const bare = await loadEvaluationContext(without.project, without.response)
    expect(bare!.prompt.name).toBeNull()
    expect(bare!.prompt.description).toBeNull()
  })

  it('traz a versão que a RESPOSTA gravou, mesmo com versão mais nova no projeto', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { promptText: 'Prompt da rodada.' })

    const newer = await addPromptVersion(ownerDb, scene.project, admin, {
      versionNumber: 2,
      text: 'Prompt reescrito depois.',
    })
    expect(newer).toBeTruthy()

    const context = await loadEvaluationContext(scene.project, scene.response)

    expect(context!.prompt.versionNumber).toBe(1)
    expect(context!.prompt.text).toBe('Prompt da rodada.')
  })

  it('a resposta gravada com outra versão de prompt traz essa versão, e não a da rodada', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { promptText: 'Prompt da rodada.' })

    const other = await addPromptVersion(ownerDb, scene.project, admin, {
      versionNumber: 2,
      text: 'Prompt que esta resposta usou.',
    })
    const item = await addInputItem(ownerDb, scene.project, admin, { name: 'Outro item' })
    const response = await addResponse(ownerDb, scene.round, item, admin, {
      promptVersionId: other,
    })

    const context = await loadEvaluationContext(scene.project, response)

    expect(context!.prompt.versionNumber).toBe(2)
    expect(context!.prompt.text).toBe('Prompt que esta resposta usou.')
  })

  it('a resposta de outro projeto não é lida', async () => {
    const admin = await newUser('Admin')
    const mine = await scenario(admin)
    const theirs = await scenario(admin)

    expect(await loadEvaluationContext(mine.project, theirs.response)).toBeNull()
  })

  it('id inexistente ou fora de formato devolve nulo', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)

    expect(await loadEvaluationContext(scene.project, ABSENT)).toBeNull()
    expect(await loadEvaluationContext(scene.project, 'não-é-uuid')).toBeNull()
    expect(await loadEvaluationContext('não-é-uuid', scene.response)).toBeNull()
  })
})
