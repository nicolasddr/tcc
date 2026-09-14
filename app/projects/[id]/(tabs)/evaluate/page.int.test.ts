import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOTFOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import ProjectEvaluatePage from '@/app/projects/[id]/(tabs)/evaluate/page'
import { EvaluationForm } from '@/app/projects/[id]/(tabs)/evaluate/evaluation-form'
import { buildQueue } from '@/app/projects/[id]/(tabs)/evaluate/queue'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { listRoundResponses } from '@/app/projects/[id]/pipeline/responses'
import { PHASE_1, PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { ButtonLink } from '@/app/components/ui/button'
import { ProgressBar } from '@/app/components/ui/stat'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  addEvaluation,
  memberId as memberIdOf,
  cleanup,
} from '@/test/helpers'

function findElement(node: unknown, type: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  if (node.type === type) return node
  for (const value of Object.values(node.props as Record<string, unknown>)) {
    const found = findElement(value, type)
    if (found) return found
  }
  return null
}

function collectText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (isValidElement(node)) {
    return collectText((node.props as { children?: unknown }).children)
  }
  return ''
}

function textOf(node: unknown): string {
  return collectText(node).replace(/\s+/g, ' ').trim()
}

type FormProps = Parameters<typeof EvaluationForm>[0]

function render(id: string, response?: string) {
  return ProjectEvaluatePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(response ? { response } : {}),
  })
}

async function open(id: string, response?: string) {
  if (response) return render(id, response)

  const chosen = await render(id).then(
    () => null,
    (error: Error) => /NEXT_REDIRECT:.*[?]response=(.+)$/.exec(error.message)?.[1] ?? null,
  )
  expect(chosen).toBeTruthy()
  return render(id, chosen!)
}

function formOf(tree: unknown): FormProps {
  const element = findElement(tree, EvaluationForm)
  expect(element).toBeTruthy()
  return element!.props as FormProps
}

function markupOf(props: FormProps): string {
  return renderToStaticMarkup(createElement(EvaluationForm, props))
}

type Scene = {
  project: string
  round: string
  codebookVersion: string
  responses: string[]
}

describe('app/projects/[id]/evaluate — a tela do avaliador', () => {
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
      definitions?: { title: string; description?: string; criteria?: { name: string }[] }[]
      generalCriteria?: { name: string }[]
      responses?: number
      phase?: number
      openRound?: boolean
    } = {},
  ): Promise<Scene> {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: opts.phase ?? PHASE_2,
    })
    projs.push(project)

    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      definitions: (
        opts.definitions ?? [{ title: 'Informacional', criteria: [{ name: 'Clareza' }] }]
      ).map((definition) => ({
        title: definition.title,
        type: 'category',
        description: definition.description ?? null,
        criteria: definition.criteria ?? [],
      })),
      generalCriteria: opts.generalCriteria,
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    if (opts.openRound === false) {
      return { project, round: '', codebookVersion, responses: [] }
    }

    const round = await addRound(ownerDb, project, admin, codebookVersion, promptVersion)

    const responses: string[] = []
    for (let index = 0; index < (opts.responses ?? 1); index += 1) {
      const item = await addInputItem(ownerDb, project, admin, {
        name: `Item ${index + 1}`,
      })
      responses.push(
        await addResponse(ownerDb, round, item, admin, {
          text: `Resposta ${index + 1}`,
        }),
      )
    }

    return { project, round, codebookVersion, responses }
  }

  async function newEvaluator(project: string, name = 'Avaliadora'): Promise<string> {
    const user = await newUser(name)
    await addActiveEvaluator(ownerDb, project, user)
    return user
  }

  /** A fila que AQUELE vínculo deve ver, calculada fora da página. */
  async function queueOf(scene: Scene, evaluator: string): Promise<string[]> {
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    const listed = await listRoundResponses(scene.round)
    return buildQueue(listed, [], member, scene.round).map((response) => response.id)
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o avaliador ativo vê o formulário, com os critérios gerais dentro de cada definição', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        { title: 'Informacional', criteria: [{ name: 'Cita a fonte' }] },
        { title: 'Transacional', criteria: [{ name: 'Aciona' }] },
      ],
      generalCriteria: [{ name: 'Clareza' }],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const props = formOf(await open(scene.project))

    expect(props.response.id).toBe(scene.responses[0])
    expect(props.response.text).toBe('Resposta 1')
    expect(props.submitted).toBeNull()
    expect(props.roundNumber).toBe(1)

    expect(
      props.cells.map((cell) => `${cell.definition.title}/${cell.criterion.name}`),
    ).toEqual([
      'Informacional/Cita a fonte',
      'Informacional/Clareza',
      'Transacional/Aciona',
      'Transacional/Clareza',
    ])

    const html = markupOf(props)
    expect(html).toContain('Enviar avalia')
    expect(html).toContain('Alto')
    expect(html).toContain('Médio')
    expect(html).toContain('Baixo')
    expect(html).toContain('<textarea')
  })

  it('a descrição da definição e a do critério ficam no tooltip ao lado do nome', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        {
          title: 'Informacional',
          description: 'busca informação',
          criteria: [{ name: 'Clareza' }],
        },
      ],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const html = markupOf(formOf(await open(scene.project)))
    expect(html).toContain('busca informa')
  })

  it('sem nota em toda célula, o envio fica travado e a tela diz qual definição falta', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        { title: 'Informacional', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', criteria: [{ name: 'Aciona' }] },
      ],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const html = markupOf(formOf(await open(scene.project)))

    expect(html).toContain('disabled=""')
    expect(html).toContain('“Informacional”')
    expect(html).toContain('“Transacional”')
    expect(html).toContain('ainda t')
  })

  it('a resposta já avaliada aparece em leitura, sem campo e sem editar nem apagar', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [{ title: 'Informacional', criteria: [{ name: 'Clareza' }] }],
    })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)

    const codebook = await loadCodebookVersion(scene.project, scene.codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member, {
      cells: cells.map((cell) => ({
        definitionId: cell.definition.id,
        criterionId: cell.criterion.id,
        value: 'medium' as const,
        justification: 'porque sim',
      })),
    })

    auth.userId = evaluator
    const props = formOf(await open(scene.project))
    expect(props.submitted).not.toBeNull()

    const html = markupOf(props)
    expect(html).toContain('Médio')
    expect(html).toContain('porque sim')
    expect(html).toContain('definitivo')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('Enviar avalia')
    expect(html).not.toContain('Editar')
    expect(html).not.toContain('Apagar')
    expect(html).not.toContain('Excluir')
  })

  it('sem ?response= na rota, a página redireciona para a primeira DA MINHA fila', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 6 })
    const evaluator = await newEvaluator(scene.project)
    const [first] = await queueOf(scene, evaluator)

    auth.userId = evaluator
    await expect(render(scene.project)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${scene.project}/evaluate?response=${first}`,
    )
  })

  it('dois avaliadores do mesmo projeto abrem em ordens diferentes', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 8 })
    const mine = await newEvaluator(scene.project, 'Avaliadora')
    const theirs = await newEvaluator(scene.project, 'Avaliador')

    const myQueue = await queueOf(scene, mine)
    const theirQueue = await queueOf(scene, theirs)
    expect(theirQueue).not.toEqual(myQueue)

    auth.userId = mine
    expect(formOf(await open(scene.project)).response.id).toBe(myQueue[0])

    auth.userId = theirs
    expect(formOf(await open(scene.project)).response.id).toBe(theirQueue[0])
  })

  it('o rótulo vem da ordem canônica e é o mesmo para os dois avaliadores', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 4 })
    const mine = await newEvaluator(scene.project, 'Avaliadora')
    const theirs = await newEvaluator(scene.project, 'Avaliador')

    const third = scene.responses[2]

    auth.userId = mine
    expect(formOf(await open(scene.project, third)).label).toBe('Resposta 3')

    auth.userId = theirs
    expect(formOf(await open(scene.project, third)).label).toBe('Resposta 3')
  })

  it('depois de enviada, a rota fica na mesma resposta e oferece ir para a próxima', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 2 })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member)

    auth.userId = evaluator
    const tree = await render(scene.project, scene.responses[0])
    expect(formOf(tree).response.id).toBe(scene.responses[0])
    expect(formOf(tree).submitted).not.toBeNull()

    const link = findElement(tree, ButtonLink)
    expect(link).toBeTruthy()
    expect((link!.props as { href: string }).href).toBe(
      `/projects/${scene.project}/evaluate?response=${scene.responses[1]}`,
    )
  })

  it('sem próxima resposta a avaliar, a tela não oferece avançar', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member)

    auth.userId = evaluator
    expect(findElement(await render(scene.project, scene.responses[0]), ButtonLink)).toBeNull()
  })

  it('a rota escolhe a resposta pedida, e sem pedido abre a primeira ainda não avaliada', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 2 })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member)

    auth.userId = evaluator
    expect(formOf(await open(scene.project)).response.id).toBe(scene.responses[1])
    expect(formOf(await open(scene.project, scene.responses[0])).response.id).toBe(
      scene.responses[0],
    )
  })

  it('nenhuma tela do avaliador exibe coeficiente', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)
    const page = `${textOf(tree)} ${markupOf(formOf(tree))}`.toLowerCase()

    expect(page).not.toContain('coeficiente')
    expect(page).not.toContain('kappa')
    expect(page).not.toContain('concord')
  })

  it('sem codebook nenhum, a tela diz que o administrador ainda está montando', async () => {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: PHASE_2,
    })
    projs.push(project)
    const evaluator = await newEvaluator(project)

    auth.userId = evaluator
    const tree = await render(project)
    expect(findElement(tree, EvaluationForm)).toBeNull()
    expect(textOf(tree)).toContain('montando o codebook')
  })

  it('com definição sem critério, a espera ainda é o codebook', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      openRound: false,
      definitions: [{ title: 'Informacional', criteria: [] }],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    expect(textOf(await render(scene.project))).toContain('montando o codebook')
  })

  it('antes da Fase 2, a espera é o codebook mesmo com o codebook pronto', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { openRound: false, phase: PHASE_1 })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    expect(textOf(await render(scene.project))).toContain('montando o codebook')
  })

  it('com o codebook pronto e sem rodada aberta, a tela espera a rodada', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { openRound: false })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await render(scene.project)
    expect(findElement(tree, EvaluationForm)).toBeNull()
    expect(textOf(tree)).toContain('abrir uma rodada')
  })

  it('com rodada aberta e nenhuma resposta gerada, a tela espera as respostas', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 0 })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await render(scene.project)
    expect(findElement(tree, EvaluationForm)).toBeNull()
    expect(textOf(tree)).toContain('ainda não tem resposta gerada')
  })

  it('com tudo avaliado, a faixa diz que terminei SEM esconder a última resposta', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 2 })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    for (const response of scene.responses) {
      await addEvaluation(ownerDb, scene.round, response, member)
    }

    auth.userId = evaluator
    const tree = await open(scene.project, scene.responses[1])
    const text = textOf(tree)

    expect(formOf(tree).response.id).toBe(scene.responses[1])
    expect(formOf(tree).submitted).not.toBeNull()
    expect(text).toContain('Você terminou')
    expect(text).toContain('aguarda o fechamento')
    expect(text).toContain('2 de 2 respostas avaliadas')
  })

  it('a barra de progresso conta só as MINHAS avaliações', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 4 })
    const mine = await newEvaluator(scene.project, 'Avaliadora')
    const theirs = await newEvaluator(scene.project, 'Avaliador')
    const myMember = await memberIdOf(ownerDb, scene.project, mine)
    const theirMember = await memberIdOf(ownerDb, scene.project, theirs)

    await addEvaluation(ownerDb, scene.round, scene.responses[0], myMember)
    for (const response of scene.responses.slice(0, 3)) {
      await addEvaluation(ownerDb, scene.round, response, theirMember)
    }

    auth.userId = mine
    const tree = await open(scene.project)
    const bar = findElement(tree, ProgressBar)

    expect(bar).toBeTruthy()
    expect(bar!.props).toMatchObject({ value: 1, max: 4 })
    expect(textOf(tree)).toContain('1 de 4 respostas avaliadas')
  })

  it('o administrador sem vínculo de avaliador não alcança a tela', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)

    auth.userId = admin
    await expect(render(scene.project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o administrador-avaliador alcança a tela pelo vínculo de avaliador', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    await addActiveEvaluator(ownerDb, scene.project, admin)

    auth.userId = admin
    expect(formOf(await open(scene.project)).response.id).toBe(scene.responses[0])
  })

  it('quem não é membro não alcança a tela', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const stranger = await newUser('Estranho')

    auth.userId = stranger
    await expect(render(scene.project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o avaliador em onboarding é mandado concluir o onboarding', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const invited = await newUser('Convidado')
    await addPendingMember(ownerDb, scene.project, invited)

    auth.userId = invited
    await expect(render(scene.project)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${scene.project}/onboarding`,
    )
  })
})
