import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq, sql } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

const llm = vi.hoisted(() => ({
  inputs: [] as string[],
  text: 'Categoria: Informacional',
  model: 'modelo-de-teste',
  modelVersion: 'modelo-de-teste-2026-05-01',
  fails: false,
  failure: null as LlmFailure | null,
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
      if (llm.failure) throw new LlmError(llm.failure)
      if (llm.fails) throw new Error('provedor indisponível')
      return { text: llm.text, model: llm.model, modelVersion: llm.modelVersion }
    },
  }
})

import {
  testPrompt,
  savePrompt,
  type PromptTestState,
} from '@/app/projects/[id]/pipeline/actions'
import { createRound, generateResponses } from '@/app/projects/[id]/(tabs)/rounds/actions'
import { loadCodebook } from '@/app/projects/[id]/pipeline/codebook'
import { loadPrompt } from '@/app/projects/[id]/pipeline/prompt'
import {
  composeLlmInput,
  CODEBOOK_HEADING,
  DEFINITION_PREFIX,
  DEFINITIONS_HEADING,
  GENERAL_CRITERIA_HEADING,
  ITEM_HEADING,
} from '@/app/projects/[id]/pipeline/llm-input'
import { PHASE_1, PHASE_2, PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'
import { DEFINITION_TYPE_OPTIONS, definitionTypeLabel } from '@/app/projects/definition-types'
import { SCALE, scaleLabel } from '@/app/projects/[id]/(tabs)/evaluate/scale'
import type { LlmFailure } from '@/lib/ai/failure'
import { projectResponsesMax, resetProjectResponses } from '@/lib/ai/quota'
import { ownerDb, responses, rounds } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  cleanup,
  type CriterionFixture,
  type DefinitionFixture,
} from '@/test/helpers'

const PROMPT_TEXT = 'Classifique a consulta de busca abaixo.'
const ITEM_CONTENT = 'como fazer bolo de cenoura'
const DEFINITIONS = [
  { title: 'Navegacional', type: 'category' },
  { title: 'Informacional', type: 'category' },
  { title: 'Transacional', type: 'category' },
]

const RICH_DEFINITIONS = [
  {
    title: 'Navegacional',
    type: 'category',
    description: 'Descrição da navegacional.',
    criteria: [{ name: 'Critério da navegacional', description: 'Busca um site específico.' }],
  },
  {
    title: 'Informacional',
    type: 'category',
    description: 'Descrição da informacional.',
    criteria: [{ name: 'Critério da informacional' }],
  },
  {
    title: 'Transacional',
    type: 'category',
    description: 'Descrição da transacional.',
    criteria: [{ name: 'Critério da transacional' }],
  },
]

const RICH_GENERAL_CRITERIA = [
  { name: 'Critério geral do codebook', description: 'Vale para todas as definições.' },
]

function fd(projectId: string, itemId?: string): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  if (itemId !== undefined) form.set('item_id', itemId)
  return form
}

function okOf(state: PromptTestState) {
  expect(state).toMatchObject({ ok: true })
  return state as Exclude<PromptTestState, { error: string } | null>
}

function spyOnFetch() {
  return vi.spyOn(globalThis as { fetch: typeof fetch }, 'fetch')
}

async function rowCounts(): Promise<Record<string, number>> {
  const rows = await ownerDb.execute<{ table_name: string; count: string }>(sql`
    select
      table_name,
      (xpath(
        '/row/c/text()',
        query_to_xml(
          format('select count(*) as c from public.%I', table_name),
          false,
          true,
          ''
        )
      ))[1]::text as count
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `)
  return Object.fromEntries(rows.map((row) => [row.table_name, Number(row.count)]))
}

describe('app/projects/[id]/pipeline/actions — testar o prompt sem persistir nada', () => {
  let users: string[]
  let projs: string[]
  let fetchSpy: ReturnType<typeof spyOnFetch>

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

  async function readyProject(
    admin: string,
    opts: {
      phase?: number
      definitions?: DefinitionFixture[]
      generalCriteria?: CriterionFixture[]
    } = {},
  ): Promise<{ project: string; item: string }> {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: opts.phase,
    })
    projs.push(project)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: opts.definitions ?? DEFINITIONS,
      generalCriteria: opts.generalCriteria,
    })
    await addPromptVersion(ownerDb, project, admin, { text: PROMPT_TEXT })
    const item = await addInputItem(ownerDb, project, admin, {
      name: 'Consulta 001',
      content: ITEM_CONTENT,
    })
    return { project, item }
  }

  async function expectedInput(phase: number, project: string): Promise<string> {
    const codebook = await loadCodebook(project)
    const prompt = await loadPrompt(project)
    return composeLlmInput({
      phase,
      promptText: prompt.version?.text ?? '',
      definitions: codebook.definitions,
      criteria: codebook.criteria,
      itemContent: ITEM_CONTENT,
    })
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
    llm.inputs = []
    llm.text = 'Categoria: Informacional'
    llm.fails = false
    llm.failure = null
    resetProjectResponses()
    delete process.env.LLM_PROJECT_RESPONSES_MAX
    delete process.env.OPENAI_API_KEY
    fetchSpy = spyOnFetch()
  })
  afterEach(async () => {
    fetchSpy.mockRestore()
    resetProjectResponses()
    delete process.env.LLM_PROJECT_RESPONSES_MAX
    delete process.env.OPENAI_API_KEY
    await cleanup(projs, users)
  })

  it('devolve a saída da LLM na tela, com o identificador do modelo usado na chamada', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)

    auth.userId = admin
    const result = await testPrompt(null, fd(project, item))

    expect(result).toMatchObject({ ok: true, output: llm.text, model: llm.model })
  })

  it('monta o envio com o prompt vigente, os títulos das definições e o conteúdo do item', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)

    auth.userId = admin
    await testPrompt(null, fd(project, item))

    expect(llm.inputs).toHaveLength(1)
    const input = llm.inputs[0]
    expect(input).toContain(PROMPT_TEXT)
    expect(input).toContain(ITEM_CONTENT)
    for (const definition of DEFINITIONS) {
      expect(input).toContain(definition.title)
    }
    expect(input.indexOf(DEFINITIONS_HEADING)).toBeGreaterThan(input.indexOf(PROMPT_TEXT))
    expect(input.indexOf(ITEM_HEADING)).toBeGreaterThan(input.indexOf(DEFINITIONS_HEADING))
  })

  it('leva as definições na ordem salva na versão', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin, {
      definitions: [...DEFINITIONS].reverse(),
    })

    auth.userId = admin
    await testPrompt(null, fd(project, item))

    const input = llm.inputs[0]
    const positions = [...DEFINITIONS]
      .reverse()
      .map((definition) => input.indexOf(definition.title))
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('envia o texto do prompt VIGENTE, não o de uma versão anterior', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)
    await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 2,
      text: 'Prompt novo, este é o vigente.',
    })

    auth.userId = admin
    await testPrompt(null, fd(project, item))

    expect(llm.inputs[0]).toContain('Prompt novo, este é o vigente.')
    expect(llm.inputs[0]).not.toContain(PROMPT_TEXT)
  })

  it.each([PHASE_1, PHASE_2])(
    'na Fase %i envia só os títulos, mesmo com descrições e critérios cadastrados',
    async (phase) => {
      const admin = await newUser('Admin')
      const { project, item } = await readyProject(admin, {
        phase,
        definitions: RICH_DEFINITIONS,
        generalCriteria: RICH_GENERAL_CRITERIA,
      })

      auth.userId = admin
      expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })

      expect(llm.inputs).toEqual([await expectedInput(phase, project)])
      const input = llm.inputs[0]
      expect(input).toContain(DEFINITIONS_HEADING)
      expect(input).not.toContain(CODEBOOK_HEADING)
      expect(input).not.toContain(GENERAL_CRITERIA_HEADING)
      for (const definition of RICH_DEFINITIONS) {
        expect(input).toContain(definition.title)
        expect(input).not.toContain(definition.description)
        for (const criterion of definition.criteria) {
          expect(input).not.toContain(criterion.name)
        }
      }
      for (const criterion of RICH_GENERAL_CRITERIA) {
        expect(input).not.toContain(criterion.name)
      }
    },
  )

  it('na Fase 3 envia o codebook completo da versão vigente', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin, {
      phase: PHASE_3,
      definitions: RICH_DEFINITIONS,
      generalCriteria: RICH_GENERAL_CRITERIA,
    })

    auth.userId = admin
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })

    expect(llm.inputs).toEqual([await expectedInput(PHASE_3, project)])
    const input = llm.inputs[0]
    expect(input).toContain(PROMPT_TEXT)
    expect(input).toContain(ITEM_CONTENT)
    expect(input).toContain(CODEBOOK_HEADING)
    expect(input).not.toContain(DEFINITIONS_HEADING)
    for (const definition of RICH_DEFINITIONS) {
      expect(input).toContain(`${DEFINITION_PREFIX}${definition.title}`)
      expect(input).toContain(definition.description)
      for (const criterion of definition.criteria) {
        expect(input).toContain(criterion.name)
      }
    }
    expect(input.split(GENERAL_CRITERIA_HEADING)).toHaveLength(2)
    for (const criterion of RICH_GENERAL_CRITERIA) {
      expect(input).toContain(`- ${criterion.name}: ${criterion.description}`)
    }

    const typeValues = DEFINITION_TYPE_OPTIONS.map((option) => option.value)
    const typeLabels = typeValues.map((value) => definitionTypeLabel(value)!)
    const scaleLabels = SCALE.map((value) => scaleLabel(value))
    for (const forbidden of [...typeValues, ...typeLabels, ...scaleLabels]) {
      expect(input).not.toContain(forbidden)
    }
  })

  it('na Fase 3 envia o codebook da versão VIGENTE, não o de uma versão anterior', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin, {
      phase: PHASE_3,
      definitions: RICH_DEFINITIONS,
      generalCriteria: RICH_GENERAL_CRITERIA,
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
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })

    expect(llm.inputs).toEqual([await expectedInput(PHASE_3, project)])
    const input = llm.inputs[0]
    expect(input).toContain('Descrição da versão 2.')
    expect(input).toContain('Critério da versão 2')
    expect(input).toContain('Geral da versão 2')
    for (const definition of RICH_DEFINITIONS) {
      expect(input).not.toContain(definition.description)
      for (const criterion of definition.criteria) {
        expect(input).not.toContain(criterion.name)
      }
    }
    expect(input).not.toContain(RICH_GENERAL_CRITERIA[0].name)
  })

  it('na Fase 3 testa mesmo sem descrição nem critério, com só os títulos no codebook', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin, { phase: PHASE_3 })

    auth.userId = admin
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })

    expect(llm.inputs).toEqual([await expectedInput(PHASE_3, project)])
    const input = llm.inputs[0]
    const codebook = [
      CODEBOOK_HEADING,
      ...DEFINITIONS.map((definition) => `${DEFINITION_PREFIX}${definition.title}`),
    ].join('\n\n')
    expect(input).toContain(`${codebook}\n\n${ITEM_HEADING}`)
    expect(input).not.toContain('\n\n\n')
    expect(input).not.toContain(GENERAL_CRITERIA_HEADING)
  })

  it.each([PHASE_2, PHASE_3])(
    'na Fase %i o retorno traz a entrada enviada junto com a saída',
    async (phase) => {
      const admin = await newUser('Admin')
      const { project, item } = await readyProject(admin, {
        phase,
        definitions: RICH_DEFINITIONS,
        generalCriteria: RICH_GENERAL_CRITERIA,
      })

      auth.userId = admin
      const result = okOf(await testPrompt(null, fd(project, item)))

      expect(llm.inputs).toHaveLength(1)
      expect(result.input).toBe(llm.inputs[0])
      expect(result.input).toBe(await expectedInput(phase, project))
      expect(result.output).toBe(llm.text)
    },
  )

  it('devolve a entrada sem normalizar quebras de linha, recuos nem espaços', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin, { phase: PHASE_3 })
    const promptText = 'Classifique:\r\n    com recuo  \r\nfim com espaço '
    const content = '  primeira linha\n\n\tsegunda depois de linha em branco\n'
    await addPromptVersion(ownerDb, project, admin, { versionNumber: 2, text: promptText })
    const item = await addInputItem(ownerDb, project, admin, {
      name: 'Consulta com espaços',
      content,
    })

    auth.userId = admin
    const result = okOf(await testPrompt(null, fd(project, item)))

    expect(result.input).toBe(llm.inputs[0])
    expect(result.input.startsWith(`${promptText}\n\n`)).toBe(true)
    expect(result.input.endsWith(`${ITEM_HEADING}\n${content}`)).toBe(true)
  })

  it.each([PHASE_2, PHASE_3])(
    'na Fase %i a entrada do teste é a que uma rodada enviaria para o mesmo item',
    async (phase) => {
      const admin = await newUser('Admin')
      const { project, item } = await readyProject(admin, {
        phase,
        definitions: RICH_DEFINITIONS,
        generalCriteria: RICH_GENERAL_CRITERIA,
      })

      auth.userId = admin
      const tested = okOf(await testPrompt(null, fd(project, item)))

      const newRound = new FormData()
      newRound.set('project_id', project)
      expect(await createRound(null, newRound)).toMatchObject({ ok: true })

      const [round] = await ownerDb
        .select({ id: rounds.id, phase: rounds.phase })
        .from(rounds)
        .where(eq(rounds.projectId, project))
      expect(round.phase).toBe(phase)

      const generate = new FormData()
      generate.set('project_id', project)
      generate.set('round_id', round.id)
      generate.append('item_ids', item)
      expect(await generateResponses(null, generate)).toMatchObject({
        ok: true,
        failed: [],
      })

      const sent = await ownerDb
        .select({ inputItemId: responses.inputItemId, sentInput: responses.sentInput })
        .from(responses)
        .where(eq(responses.roundId, round.id))
      expect(sent).toEqual([{ inputItemId: item, sentInput: tested.input }])
      expect(llm.inputs).toEqual([tested.input, tested.input])
    },
  )

  it.each([PHASE_1, PHASE_2, PHASE_3])(
    'na Fase %i não grava nada: nenhuma linha nova aparece em tabela nenhuma',
    async (phase) => {
      const admin = await newUser('Admin')
      const { project, item } = await readyProject(admin, {
        phase,
        definitions: RICH_DEFINITIONS,
        generalCriteria: RICH_GENERAL_CRITERIA,
      })

      auth.userId = admin
      const before = await rowCounts()
      const result = await testPrompt(null, fd(project, item))
      const after = await rowCounts()

      expect(result).toMatchObject({ ok: true })
      expect(after).toEqual(before)
    },
  )

  it('na Fase 3 não congela a versão do codebook nem a do prompt', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin, {
      phase: PHASE_3,
      definitions: RICH_DEFINITIONS,
      generalCriteria: RICH_GENERAL_CRITERIA,
    })

    auth.userId = admin
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })

    const codebook = await loadCodebook(project)
    const prompt = await loadPrompt(project)
    expect(codebook.version?.usedAt).toBeNull()
    expect(codebook.isOpen).toBe(true)
    expect(prompt.version?.usedAt).toBeNull()
    expect(prompt.isOpen).toBe(true)
  })

  it('não congela versão nenhuma: dá para editar o prompt e testar de novo', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)

    auth.userId = admin
    await testPrompt(null, fd(project, item))

    const codebook = await loadCodebook(project)
    const prompt = await loadPrompt(project)
    expect(codebook.version?.usedAt).toBeNull()
    expect(codebook.isOpen).toBe(true)
    expect(prompt.version?.usedAt).toBeNull()
    expect(prompt.isOpen).toBe(true)

    const edit = new FormData()
    edit.set('project_id', project)
    edit.set('version_id', prompt.version!.id)
    edit.set('text', 'Prompt corrigido depois do teste.')
    expect(await savePrompt(null, edit)).toMatchObject({ ok: true })

    const again = await loadPrompt(project)
    expect(again.version?.versionNumber).toBe(1)
    expect(again.version?.text).toBe('Prompt corrigido depois do teste.')
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })
    expect(llm.inputs[1]).toContain('Prompt corrigido depois do teste.')
  })

  it('recusa o teste sem definição, sem texto de prompt ou sem item, e não chama a LLM', async () => {
    const admin = await newUser('Admin')

    const semDefinicao = await newProject(admin)
    await addPromptVersion(ownerDb, semDefinicao, admin, { text: PROMPT_TEXT })
    const itemSemDefinicao = await addInputItem(ownerDb, semDefinicao, admin)

    const semPrompt = await newProject(admin)
    await addCodebookVersion(ownerDb, semPrompt, admin, { definitions: DEFINITIONS })
    const itemSemPrompt = await addInputItem(ownerDb, semPrompt, admin)

    const semItem = await newProject(admin)
    await addCodebookVersion(ownerDb, semItem, admin, { definitions: DEFINITIONS })
    await addPromptVersion(ownerDb, semItem, admin, { text: PROMPT_TEXT })

    auth.userId = admin
    expect(await testPrompt(null, fd(semDefinicao, itemSemDefinicao))).toHaveProperty('error')
    expect(await testPrompt(null, fd(semPrompt, itemSemPrompt))).toHaveProperty('error')
    expect(await testPrompt(null, fd(semItem, crypto.randomUUID()))).toHaveProperty('error')
    expect(await testPrompt(null, fd(semItem))).toHaveProperty('error')
    expect(llm.inputs).toEqual([])
  })

  it('o Avaliador é recusado, e a LLM não é chamada', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const { project, item } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    expect(await testPrompt(null, fd(project, item))).toHaveProperty('error')
    expect(llm.inputs).toEqual([])
  })

  it('o administrador de um projeto não testa com o item de outro', async () => {
    const admin = await newUser('Admin')
    const outro = await newUser('Outro Admin')
    const { project } = await readyProject(admin)
    const alheio = await readyProject(outro)

    auth.userId = admin
    expect(await testPrompt(null, fd(project, alheio.item))).toHaveProperty('error')
    expect(await testPrompt(null, fd(alheio.project, alheio.item))).toHaveProperty('error')
    expect(llm.inputs).toEqual([])
  })

  it('falha da LLM vira erro tratado, sem gravar nada e sem derrubar a ação', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)
    llm.fails = true

    auth.userId = admin
    const before = await rowCounts()
    const result = await testPrompt(null, fd(project, item))
    const after = await rowCounts()

    expect(result).toHaveProperty('error')
    expect(result).not.toHaveProperty('input')
    expect(after).toEqual(before)
  })

  it('cada família de falha da LLM vira uma mensagem própria, distinguível das outras', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)
    auth.userId = admin

    const families: LlmFailure[] = [
      'auth',
      'model',
      'too_large',
      'timeout',
      'unavailable',
      'unknown',
    ]
    const messages: Record<string, string> = {}

    for (const family of families) {
      llm.failure = family
      const result = await testPrompt(null, fd(project, item))
      expect(result).toHaveProperty('error')
      messages[family] = (result as { error: string }).error
    }

    expect(new Set(Object.values(messages)).size).toBe(families.length)
    expect(messages.auth).toMatch(/chave/i)
    expect(messages.model).toMatch(/modelo/i)
    expect(messages.too_large).toMatch(/grande demais/i)
    expect(messages.timeout).toMatch(/demorou/i)
    expect(messages.unavailable).toMatch(/fora do ar|sobrecarregado/i)

    for (const message of Object.values(messages)) {
      expect(message).not.toMatch(/llm_failure|Error|fetch|status/)
    }
  })

  it('nenhuma mensagem de erro expõe a chave da OpenAI nem trechos dela', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)
    process.env.OPENAI_API_KEY = 'sk-teste-CHAVE-SECRETA-1234567890'

    auth.userId = admin
    llm.failure = 'auth'
    const result = await testPrompt(null, fd(project, item))

    const message = (result as { error: string }).error
    expect(message).not.toContain('sk-teste')
    expect(message).not.toContain(process.env.OPENAI_API_KEY)
  })

  it('depois do erro, dá para testar de novo sem sair da tela', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)

    auth.userId = admin
    llm.failure = 'unavailable'
    const failed = await testPrompt(null, fd(project, item))
    expect(failed).toHaveProperty('error')

    llm.failure = null
    const retried = await testPrompt(failed, fd(project, item))
    expect(retried).toMatchObject({ ok: true, output: llm.text })
  })

  it('atingido o teto de respostas do projeto, a ação é recusada e a LLM não é chamada', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)
    process.env.LLM_PROJECT_RESPONSES_MAX = '2'

    auth.userId = admin
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })

    const refused = await testPrompt(null, fd(project, item))
    expect(refused).toHaveProperty('error')
    expect((refused as { error: string }).error).toContain(String(projectResponsesMax()))
    expect((refused as { error: string }).error).toMatch(/teto/i)
    expect(llm.inputs).toHaveLength(2)
  })

  it('na Fase 3 o teto também vale: a segunda chamada é recusada sem ir à LLM', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin, {
      phase: PHASE_3,
      definitions: RICH_DEFINITIONS,
      generalCriteria: RICH_GENERAL_CRITERIA,
    })
    process.env.LLM_PROJECT_RESPONSES_MAX = '1'

    auth.userId = admin
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })

    const refused = await testPrompt(null, fd(project, item))
    expect(refused).not.toHaveProperty('input')
    expect((refused as { error: string }).error).toContain(String(projectResponsesMax()))
    expect((refused as { error: string }).error).toMatch(/teto/i)
    expect(llm.inputs).toHaveLength(1)
  })

  it('teto zero recusa desde a primeira chamada, sem nada ir à LLM', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)
    process.env.LLM_PROJECT_RESPONSES_MAX = '0'

    auth.userId = admin
    expect(await testPrompt(null, fd(project, item))).toHaveProperty('error')
    expect(llm.inputs).toEqual([])
  })

  it('o teto é por projeto: um projeto no limite não trava o outro', async () => {
    const admin = await newUser('Admin')
    const primeiro = await readyProject(admin)
    const segundo = await readyProject(admin)
    process.env.LLM_PROJECT_RESPONSES_MAX = '1'

    auth.userId = admin
    expect(await testPrompt(null, fd(primeiro.project, primeiro.item))).toMatchObject({
      ok: true,
    })
    expect(await testPrompt(null, fd(primeiro.project, primeiro.item))).toHaveProperty(
      'error',
    )
    expect(await testPrompt(null, fd(segundo.project, segundo.item))).toMatchObject({
      ok: true,
    })
  })

  it('falha da LLM não consome o teto, porque não veio resposta nenhuma', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)
    process.env.LLM_PROJECT_RESPONSES_MAX = '1'

    auth.userId = admin
    llm.failure = 'unavailable'
    expect(await testPrompt(null, fd(project, item))).toHaveProperty('error')

    llm.failure = null
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })
    expect(await testPrompt(null, fd(project, item))).toMatchObject({
      error: expect.stringMatching(/teto/i),
    })
  })

  it('o teto não é consumido por quem é recusado antes da chamada', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const { project, item } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    process.env.LLM_PROJECT_RESPONSES_MAX = '1'

    auth.userId = evaluator
    expect(await testPrompt(null, fd(project, item))).toHaveProperty('error')

    auth.userId = admin
    expect(await testPrompt(null, fd(project, item))).toMatchObject({ ok: true })
  })

  it('nenhum teste chama a OpenAI de verdade', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)

    auth.userId = admin
    await testPrompt(null, fd(project, item))

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
