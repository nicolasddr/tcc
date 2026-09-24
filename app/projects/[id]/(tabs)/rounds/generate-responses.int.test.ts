import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { asc, eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

const llm = vi.hoisted(() => ({
  inputs: [] as string[],
  text: 'Categoria: Informacional',
  model: 'modelo-pedido',
  modelVersion: 'modelo-resolvido-2026-05-01',
  failure: null as LlmFailure | null,
  failWhen: null as null | ((input: string) => LlmFailure | null),
  beforeAnswer: null as null | (() => Promise<void>),
}))

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
vi.mock('@/lib/ai', async () => {
  const { LlmError } = await import('@/lib/ai/failure')
  return {
    llmModel: () => llm.model,
    askLlm: async (input: string) => {
      llm.inputs.push(input)
      const hook = llm.beforeAnswer
      llm.beforeAnswer = null
      if (hook) await hook()
      const failure = llm.failWhen?.(input) ?? llm.failure
      if (failure) throw new LlmError(failure)
      return { text: llm.text, model: llm.model, modelVersion: llm.modelVersion }
    },
  }
})

import {
  generateResponses,
  type GenerateResponsesState,
} from '@/app/projects/[id]/(tabs)/rounds/actions'
import { SELECTION_MAX } from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { loadItemRoundUsage } from '@/app/projects/[id]/pipeline/responses'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import {
  composeLlmInput,
  CODEBOOK_HEADING,
  DEFINITIONS_HEADING,
  GENERAL_CRITERIA_HEADING,
  ITEM_HEADING,
} from '@/app/projects/[id]/pipeline/llm-input'
import { PHASE_2, PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'
import type { LlmFailure } from '@/lib/ai/failure'
import { resetProjectResponses } from '@/lib/ai/quota'
import { RESPONSE_TEXT_MAX } from '@/lib/limits'
import { ownerDb, inputItems, responses, rounds } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  cleanup,
} from '@/test/helpers'

const PROMPT_TEXT = 'Classifique a consulta de busca abaixo.'

const DEFINITIONS = [
  {
    title: 'Navegacional',
    type: 'category',
    description: 'Descrição secreta da navegacional.',
    criteria: [{ name: 'Critério secreto', description: 'Nem isto vai à LLM.' }],
  },
  {
    title: 'Informacional',
    type: 'category',
    description: 'Descrição secreta da informacional.',
    criteria: [{ name: 'Outro critério secreto' }],
  },
  {
    title: 'Transacional',
    type: 'category',
    description: 'Descrição secreta da transacional.',
    criteria: [{ name: 'Mais um critério secreto' }],
  },
]

const GENERAL_CRITERIA = [
  { name: 'Critério geral secreto', description: 'Vale para todas as definições.' },
]

function fd(projectId: string, roundId: string, itemIds: string[] = []): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  form.set('round_id', roundId)
  for (const itemId of itemIds) form.append('item_ids', itemId)
  return form
}

function errorOf(state: GenerateResponsesState): string {
  expect(state).toHaveProperty('error')
  return (state as { error: string }).error
}

function okOf(state: GenerateResponsesState) {
  expect(state).toMatchObject({ ok: true })
  return state as Exclude<GenerateResponsesState, { error: string } | null>
}

describe('app/projects/[id]/rounds/actions — gerar respostas na rodada aberta', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function openRound(
    admin: string,
    opts: {
      items?: number
      status?: 'open' | 'closed'
      projectPhase?: number
      roundPhase?: number
    } = {},
  ) {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: opts.projectPhase ?? PHASE_2,
    })
    projs.push(project)
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      definitions: DEFINITIONS,
      generalCriteria: GENERAL_CRITERIA,
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin, {
      text: PROMPT_TEXT,
    })
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { status: opts.status ?? 'open', phase: opts.roundPhase ?? PHASE_2 },
    )

    const items: string[] = []
    for (let index = 0; index < (opts.items ?? 1); index += 1) {
      items.push(
        await addInputItem(ownerDb, project, admin, {
          name: `Consulta ${index + 1}`,
          content: `conteúdo do item ${index + 1}`,
        }),
      )
    }

    return { project, round, codebookVersion, promptVersion, items }
  }

  function listResponses(roundId: string) {
    return ownerDb
      .select({
        id: responses.id,
        inputItemId: responses.inputItemId,
        text: responses.text,
        source: responses.source,
        model: responses.model,
        modelVersion: responses.modelVersion,
        promptVersionId: responses.promptVersionId,
        codebookVersionId: responses.codebookVersionId,
        createdBy: responses.createdBy,
      })
      .from(responses)
      .where(eq(responses.roundId, roundId))
      .orderBy(asc(responses.createdAt))
  }

  async function usedAtOf(itemId: string): Promise<string | null> {
    const [row] = await ownerDb
      .select({ usedAt: inputItems.usedAt })
      .from(inputItems)
      .where(eq(inputItems.id, itemId))
    return row.usedAt
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
    llm.inputs = []
    llm.text = 'Categoria: Informacional'
    llm.failure = null
    llm.failWhen = null
    resetProjectResponses()
    delete process.env.LLM_PROJECT_RESPONSES_MAX
  })
  afterEach(async () => {
    resetProjectResponses()
    delete process.env.LLM_PROJECT_RESPONSES_MAX
    await cleanup(projs, users)
  })

  it('cada item selecionado produz uma resposta, com origem, modelo e versões', async () => {
    const admin = await newUser('Admin')
    const { project, round, items, codebookVersion, promptVersion } = await openRound(
      admin,
      { items: 3 },
    )

    auth.userId = admin
    const result = okOf(await generateResponses(null, fd(project, round, items)))

    expect(result.created).toHaveLength(3)
    expect(result.failed).toEqual([])
    expect(result.created.map((row) => row.itemId)).toEqual(items)

    const rows = await listResponses(round)
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row).toMatchObject({
        text: llm.text,
        source: 'generated',
        model: llm.model,
        modelVersion: llm.modelVersion,
        promptVersionId: promptVersion,
        codebookVersionId: codebookVersion,
        createdBy: admin,
      })
    }
  })

  it('a resposta grava o modelo PEDIDO e a versão RESOLVIDA, que são diferentes', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin)

    auth.userId = admin
    okOf(await generateResponses(null, fd(project, round, items)))

    const [row] = await listResponses(round)
    expect(row.model).toBe('modelo-pedido')
    expect(row.modelVersion).toBe('modelo-resolvido-2026-05-01')
    expect(row.model).not.toBe(row.modelVersion)
  })

  it('as versões gravadas são as que a rodada fixou, não as vigentes', async () => {
    const admin = await newUser('Admin')
    const { project, round, items, codebookVersion, promptVersion } =
      await openRound(admin)

    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 2,
      definitions: [{ title: 'Depois da rodada', type: 'category' }],
    })
    await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 2,
      text: 'Prompt novo, posterior à rodada.',
    })

    auth.userId = admin
    okOf(await generateResponses(null, fd(project, round, items)))

    const [row] = await listResponses(round)
    const [fixed] = await ownerDb
      .select({
        codebookVersionId: rounds.codebookVersionId,
        promptVersionId: rounds.promptVersionId,
      })
      .from(rounds)
      .where(eq(rounds.id, round))

    expect(row.codebookVersionId).toBe(fixed.codebookVersionId)
    expect(row.promptVersionId).toBe(fixed.promptVersionId)
    expect(row.codebookVersionId).toBe(codebookVersion)
    expect(row.promptVersionId).toBe(promptVersion)
    expect(llm.inputs[0]).toContain(PROMPT_TEXT)
    expect(llm.inputs[0]).not.toContain('Prompt novo, posterior à rodada.')
  })

  async function expectedInput(
    phase: number,
    project: string,
    codebookVersion: string,
    itemContent: string,
  ): Promise<string> {
    const codebook = await loadCodebookVersion(project, codebookVersion)
    return composeLlmInput({
      phase,
      promptText: PROMPT_TEXT,
      definitions: codebook!.definitions,
      criteria: codebook!.criteria,
      itemContent,
    })
  }

  function expectOnlyTitles(input: string) {
    expect(input).not.toContain(CODEBOOK_HEADING)
    expect(input).not.toContain(GENERAL_CRITERIA_HEADING)
    for (const definition of DEFINITIONS) {
      expect(input).toContain(definition.title)
      expect(input).not.toContain(definition.description)
      for (const criterion of definition.criteria) {
        expect(input).not.toContain(criterion.name)
      }
    }
    for (const criterion of GENERAL_CRITERIA) {
      expect(input).not.toContain(criterion.name)
    }
  }

  it('o envio é prompt mais títulos mais item, sem nenhuma descrição e sem nenhum critério', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin)

    auth.userId = admin
    okOf(await generateResponses(null, fd(project, round, items)))

    expect(llm.inputs).toHaveLength(1)
    const input = llm.inputs[0]

    expect(input).toContain(PROMPT_TEXT)
    expect(input).toContain('conteúdo do item 1')
    expect(input.indexOf(DEFINITIONS_HEADING)).toBeGreaterThan(input.indexOf(PROMPT_TEXT))
    expect(input.indexOf(ITEM_HEADING)).toBeGreaterThan(input.indexOf(DEFINITIONS_HEADING))

    const positions = DEFINITIONS.map((definition) => input.indexOf(definition.title))
    expect(positions.every((position) => position > 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)

    expectOnlyTitles(input)
  })

  it('a rodada da Fase 2 manda exatamente a entrada da Fase 2, com o codebook completo no banco', async () => {
    const admin = await newUser('Admin')
    const { project, round, items, codebookVersion } = await openRound(admin)

    auth.userId = admin
    okOf(await generateResponses(null, fd(project, round, items)))

    expect(llm.inputs).toEqual([
      await expectedInput(PHASE_2, project, codebookVersion, 'conteúdo do item 1'),
    ])
    expectOnlyTitles(llm.inputs[0])
  })

  it('a rodada da Fase 3 manda o codebook completo da versão congelada, não o da vigente', async () => {
    const admin = await newUser('Admin')
    const { project, round, items, codebookVersion } = await openRound(admin, {
      projectPhase: PHASE_3,
      roundPhase: PHASE_3,
    })

    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 2,
      definitions: [
        {
          title: 'Navegacional',
          type: 'category',
          description: 'Descrição da versão 2.',
          criteria: [{ name: 'Critério da versão 2', description: 'Só na versão 2.' }],
        },
      ],
      generalCriteria: [{ name: 'Geral da versão 2' }],
    })

    auth.userId = admin
    okOf(await generateResponses(null, fd(project, round, items)))

    expect(llm.inputs).toEqual([
      await expectedInput(PHASE_3, project, codebookVersion, 'conteúdo do item 1'),
    ])
    const input = llm.inputs[0]

    expect(input).toContain(CODEBOOK_HEADING)
    for (const definition of DEFINITIONS) {
      expect(input).toContain(definition.title)
      expect(input).toContain(definition.description)
      for (const criterion of definition.criteria) {
        expect(input).toContain(criterion.name)
      }
    }
    expect(input).toContain(GENERAL_CRITERIA_HEADING)
    expect(input).toContain(GENERAL_CRITERIA[0].name)

    expect(input).not.toContain('Descrição da versão 2.')
    expect(input).not.toContain('Critério da versão 2')
    expect(input).not.toContain('Geral da versão 2')
  })

  it('a rodada da Fase 2 continua mandando só os títulos com o projeto já na Fase 3', async () => {
    const admin = await newUser('Admin')
    const { project, round, items, codebookVersion } = await openRound(admin, {
      projectPhase: PHASE_3,
      roundPhase: PHASE_2,
    })

    auth.userId = admin
    okOf(await generateResponses(null, fd(project, round, items)))

    expect(llm.inputs).toEqual([
      await expectedInput(PHASE_2, project, codebookVersion, 'conteúdo do item 1'),
    ])
    expectOnlyTitles(llm.inputs[0])
  })

  it('a primeira resposta congela o item, e o congelamento não se desfaz na segunda rodada', async () => {
    const admin = await newUser('Admin')
    const { project, round, items, codebookVersion, promptVersion } =
      await openRound(admin)
    const [item] = items

    expect(await usedAtOf(item)).toBeNull()

    auth.userId = admin
    okOf(await generateResponses(null, fd(project, round, items)))

    const firstUse = await usedAtOf(item)
    expect(firstUse).not.toBeNull()

    await ownerDb
      .update(rounds)
      .set({ status: 'closed', closedAt: new Date().toISOString() })
      .where(eq(rounds.id, round))
    const round2 = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 2 },
    )

    okOf(await generateResponses(null, fd(project, round2, items)))
    expect(await usedAtOf(item)).toBe(firstUse)
  })

  it('o mesmo item não gera duas respostas na mesma rodada', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin)

    auth.userId = admin
    okOf(await generateResponses(null, fd(project, round, items)))

    const again = await generateResponses(null, fd(project, round, items))
    expect(errorOf(again)).toMatch(/já produziu resposta nesta rodada/i)
    expect(llm.inputs).toHaveLength(1)

    expect(await listResponses(round)).toHaveLength(1)
  })

  it('o mesmo item repetido dentro da mesma seleção é recusado antes da LLM', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin)
    const [item] = items

    auth.userId = admin
    const result = await generateResponses(null, fd(project, round, [item, item]))

    expect(errorOf(result)).toMatch(/duas vezes/i)
    expect(llm.inputs).toEqual([])
    expect(await listResponses(round)).toEqual([])
  })

  it('a unicidade do banco barra o item que entrou na rodada durante a geração', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin, { items: 2 })
    const [first, second] = items

    auth.userId = admin
    llm.beforeAnswer = async () => {
      await addResponse(ownerDb, round, second, admin, { text: 'Chegou na frente.' })
    }
    const result = okOf(await generateResponses(null, fd(project, round, [first, second])))

    expect(result.created.map((row) => row.itemId)).toEqual([first])
    expect(result.failed).toEqual([{ itemId: second, failure: 'duplicate' }])
    expect(await listResponses(round)).toHaveLength(2)
  })

  it('a geração pode ser repetida na mesma rodada, com itens diferentes', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin, { items: 3 })

    auth.userId = admin
    okOf(await generateResponses(null, fd(project, round, items.slice(0, 2))))
    okOf(await generateResponses(null, fd(project, round, items.slice(2))))

    expect(await listResponses(round)).toHaveLength(3)

    const usage = await loadItemRoundUsage(project)
    for (const item of items) expect(usage.get(item)).toEqual([1])
  })

  it('recusa a seleção vazia e a seleção acima do máximo, sem chamar a LLM', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin, {
      items: SELECTION_MAX + 1,
    })

    auth.userId = admin
    expect(errorOf(await generateResponses(null, fd(project, round, [])))).toContain(
      `1 a ${SELECTION_MAX}`,
    )
    expect(errorOf(await generateResponses(null, fd(project, round, items)))).toContain(
      `máximo ${SELECTION_MAX}`,
    )
    expect(llm.inputs).toEqual([])
    expect(await listResponses(round)).toEqual([])
  })

  it('recusa item que não é do projeto', async () => {
    const admin = await newUser('Admin')
    const outro = await newUser('Outro Admin')
    const { project, round } = await openRound(admin)
    const alheio = await openRound(outro)

    auth.userId = admin
    const result = await generateResponses(null, fd(project, round, alheio.items))

    expect(errorOf(result)).toMatch(/não é deste projeto/i)
    expect(llm.inputs).toEqual([])
  })

  it('o Avaliador é barrado, e a LLM não é chamada', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const { project, round, items } = await openRound(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const result = await generateResponses(null, fd(project, round, items))

    expect(errorOf(result)).toMatch(/administrador/i)
    expect(llm.inputs).toEqual([])
    expect(await listResponses(round)).toEqual([])
  })

  it('a rodada fechada não recebe resposta', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin, { status: 'closed' })

    auth.userId = admin
    const result = await generateResponses(null, fd(project, round, items))

    expect(errorOf(result)).toMatch(/fechada/i)
    expect(llm.inputs).toEqual([])
    expect(await listResponses(round)).toEqual([])
  })

  it('a rodada de outro projeto não é acessível pelo id', async () => {
    const admin = await newUser('Admin')
    const outro = await newUser('Outro Admin')
    const { project, items } = await openRound(admin)
    const alheio = await openRound(outro)

    auth.userId = admin
    const result = await generateResponses(null, fd(project, alheio.round, items))

    expect(errorOf(result)).toMatch(/não existe mais/i)
    expect(llm.inputs).toEqual([])
  })

  it('a falha da LLM num item não joga fora os itens que deram certo', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin, { items: 2 })

    auth.userId = admin
    llm.failure = 'unavailable'
    const first = okOf(await generateResponses(null, fd(project, round, items)))

    expect(first.created).toEqual([])
    expect(first.failed).toEqual([
      { itemId: items[0], failure: 'unavailable' },
      { itemId: items[1], failure: 'unavailable' },
    ])
    expect(await listResponses(round)).toEqual([])
    expect(await usedAtOf(items[0])).toBeNull()

    llm.failure = null
    const second = okOf(await generateResponses(null, fd(project, round, items)))
    expect(second.created).toHaveLength(2)
    expect(second.failed).toEqual([])
  })

  it('resposta vazia e resposta acima do teto viram falha, sem gravar linha nenhuma', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin)

    auth.userId = admin
    llm.text = '   '
    const blank = okOf(await generateResponses(null, fd(project, round, items)))
    expect(blank.failed).toEqual([{ itemId: items[0], failure: 'blank' }])

    llm.text = 'a'.repeat(RESPONSE_TEXT_MAX + 1)
    const long = okOf(await generateResponses(null, fd(project, round, items)))
    expect(long.failed).toEqual([{ itemId: items[0], failure: 'too_long' }])

    expect(await listResponses(round)).toEqual([])
    expect(await usedAtOf(items[0])).toBeNull()

    llm.text = 'a'.repeat(RESPONSE_TEXT_MAX)
    const exact = okOf(await generateResponses(null, fd(project, round, items)))
    expect(exact.created).toHaveLength(1)
  })

  it('o teto de respostas do projeto para a geração, e o que passou continua gravado', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin, { items: 3 })
    process.env.LLM_PROJECT_RESPONSES_MAX = '2'

    auth.userId = admin
    const result = okOf(await generateResponses(null, fd(project, round, items)))

    expect(result.created.map((row) => row.itemId)).toEqual([items[0], items[1]])
    expect(result.failed).toEqual([{ itemId: items[2], failure: 'ceiling' }])
    expect(llm.inputs).toHaveLength(2)
    expect(await listResponses(round)).toHaveLength(2)

    const refused = await generateResponses(null, fd(project, round, [items[2]]))
    expect(errorOf(refused)).toMatch(/teto/i)
    expect(llm.inputs).toHaveLength(2)
  })

  it('a retentativa dos itens que falharam grava só eles, e a falha não gastou o teto', async () => {
    const admin = await newUser('Admin')
    const { project, round, items } = await openRound(admin, { items: 3 })
    process.env.LLM_PROJECT_RESPONSES_MAX = '3'

    auth.userId = admin
    llm.failWhen = (input) => (input.includes('conteúdo do item 2') ? 'unavailable' : null)

    const first = okOf(await generateResponses(null, fd(project, round, items)))

    expect(first.created.map((row) => row.itemId)).toEqual([items[0], items[2]])
    expect(first.failed).toEqual([{ itemId: items[1], failure: 'unavailable' }])
    expect(await listResponses(round)).toHaveLength(2)
    expect(await usedAtOf(items[1])).toBeNull()

    llm.failWhen = null
    const retryIds = first.failed.map((row) => row.itemId)
    const retry = okOf(await generateResponses(null, fd(project, round, retryIds)))

    expect(retry.created.map((row) => row.itemId)).toEqual([items[1]])
    expect(retry.failed).toEqual([])
    expect(await listResponses(round)).toHaveLength(3)
    expect(await usedAtOf(items[1])).not.toBeNull()
  })

  it('quem é barrado antes da chamada não consome o teto', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const { project, round, items } = await openRound(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    process.env.LLM_PROJECT_RESPONSES_MAX = '1'

    auth.userId = evaluator
    expect(await generateResponses(null, fd(project, round, items))).toHaveProperty('error')

    auth.userId = admin
    expect(okOf(await generateResponses(null, fd(project, round, items))).created).toHaveLength(1)
  })
})
