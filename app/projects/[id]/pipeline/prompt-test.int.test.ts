import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sql } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

const llm = vi.hoisted(() => ({
  inputs: [] as string[],
  text: 'Categoria: Informacional',
  model: 'modelo-de-teste',
  fails: false,
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
vi.mock('@/lib/ai', () => ({
  llmModel: () => llm.model,
  askLlm: async (input: string) => {
    llm.inputs.push(input)
    if (llm.fails) throw new Error('provedor indisponível')
    return { text: llm.text, model: llm.model }
  },
}))

import { testPrompt, savePrompt } from '@/app/projects/[id]/pipeline/actions'
import { loadCodebook } from '@/app/projects/[id]/pipeline/codebook'
import { loadPrompt } from '@/app/projects/[id]/pipeline/prompt'
import { DEFINITIONS_HEADING, ITEM_HEADING } from '@/app/projects/[id]/pipeline/llm-input'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  cleanup,
} from '@/test/helpers'

const PROMPT_TEXT = 'Classifique a consulta de busca abaixo.'
const ITEM_CONTENT = 'como fazer bolo de cenoura'
const DEFINITIONS = [
  { title: 'Navegacional', type: 'category' },
  { title: 'Informacional', type: 'category' },
  { title: 'Transacional', type: 'category' },
]

function fd(projectId: string, itemId?: string): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  if (itemId !== undefined) form.set('item_id', itemId)
  return form
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
    opts: { definitions?: { title: string; type: string }[] } = {},
  ): Promise<{ project: string; item: string }> {
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: opts.definitions ?? DEFINITIONS,
    })
    await addPromptVersion(ownerDb, project, admin, { text: PROMPT_TEXT })
    const item = await addInputItem(ownerDb, project, admin, {
      name: 'Consulta 001',
      content: ITEM_CONTENT,
    })
    return { project, item }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
    llm.inputs = []
    llm.text = 'Categoria: Informacional'
    llm.fails = false
    fetchSpy = spyOnFetch()
  })
  afterEach(async () => {
    fetchSpy.mockRestore()
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

  it('não grava nada: nenhuma linha nova aparece em tabela nenhuma', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)

    auth.userId = admin
    const before = await rowCounts()
    const result = await testPrompt(null, fd(project, item))
    const after = await rowCounts()

    expect(result).toMatchObject({ ok: true })
    expect(after).toEqual(before)
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
    expect(after).toEqual(before)
  })

  it('nenhum teste chama a OpenAI de verdade', async () => {
    const admin = await newUser('Admin')
    const { project, item } = await readyProject(admin)

    auth.userId = admin
    await testPrompt(null, fd(project, item))

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
