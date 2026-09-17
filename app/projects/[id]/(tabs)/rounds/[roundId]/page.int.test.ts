import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOTFOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import RoundReviewPage from '@/app/projects/[id]/(tabs)/rounds/[roundId]/page'
import { ReviewGroupsList } from '@/app/projects/[id]/(tabs)/rounds/review-groups-list'
import {
  DIVERGENCE_LEGEND,
  NO_JUSTIFICATION_LABEL,
  divergenceLabel,
} from '@/app/projects/[id]/(tabs)/rounds/divergence'
import { AgreementPanel } from '@/app/projects/[id]/(tabs)/rounds/agreement-panel'
import { AgreementMatrixTable } from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix-table'
import { QueueNav } from '@/app/components/ui/queue-nav'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb, projectMembers } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  addEvaluation,
  type CellFixture,
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

// Percorre TODAS as props, e não só `children`: o texto desta tela vive também em
// `summary` (Disclosure) e em `title` (o hover da justificativa e o sentido de cada
// divergência). `className` e `href` ficam de fora para não poluir os `not.toContain`.
function deepText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return ` ${node} `
  if (Array.isArray(node)) return node.map(deepText).join('')
  if (isValidElement(node)) {
    return Object.entries(node.props as Record<string, unknown>)
      .filter(([key]) => key !== 'className' && key !== 'href')
      .map(([, value]) => deepText(value))
      .join('')
  }
  return ''
}

function textOf(node: unknown): string {
  return deepText(node).replace(/\s+/g, ' ').trim()
}

// A lista de grupos recebe dados crus por prop, então percorrer a árvore não a lê:
// é preciso renderizá-la de verdade para ver definição, célula, nota e legenda.
type ListProps = Parameters<typeof ReviewGroupsList>[0]

function listOf(tree: unknown): ListProps {
  const element = findElement(tree, ReviewGroupsList)
  expect(element).toBeTruthy()
  return element!.props as ListProps
}

function listTextOf(tree: unknown): string {
  return renderToStaticMarkup(createElement(ReviewGroupsList, listOf(tree)))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type CodebookShape = Parameters<typeof addCodebookVersion>[3]

type SceneCell = {
  definitionId: string
  criterionId: string
  definitionTitle: string
  criterionName: string
}

type Scene = {
  project: string
  round: string
  responses: string[]
  cells: SceneCell[]
}

function route(id: string, roundId: string, response: string): string {
  return `/projects/${id}/rounds/${roundId}?response=${response}`
}

function render(id: string, roundId: string, response?: string) {
  return RoundReviewPage({
    params: Promise.resolve({ id, roundId }),
    searchParams: Promise.resolve(response ? { response } : {}),
  })
}

function navOf(tree: unknown): { prev: string | null; next: string | null } {
  const nav = findElement(tree, QueueNav)
  expect(nav).toBeTruthy()
  return nav!.props as { prev: string | null; next: string | null }
}

describe('app/projects/[id]/rounds/[roundId] — a revisão de discordâncias', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  const TWO_DEFINITIONS: CodebookShape = {
    definitions: [
      { title: 'Informacional', type: 'category', criteria: [{ name: 'Precisão' }] },
      {
        title: 'Transacional',
        type: 'category',
        criteria: [{ name: 'Acionabilidade' }],
      },
    ],
    generalCriteria: [{ name: 'Clareza' }],
  }

  async function roundWith(
    admin: string,
    responseCount: number,
    opts: {
      shape?: CodebookShape
      status?: 'open' | 'closed'
      project?: string
      roundNumber?: number
    } = {},
  ): Promise<Scene> {
    let project = opts.project
    if (!project) {
      project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
        phase: PHASE_2,
      })
      projs.push(project)
    }

    const codebookVersion = await addCodebookVersion(
      ownerDb,
      project,
      admin,
      opts.shape ?? TWO_DEFINITIONS,
    )
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: opts.roundNumber ?? 1, status: opts.status ?? 'closed' },
    )

    const responses: string[] = []
    for (let index = 0; index < responseCount; index += 1) {
      const item = await addInputItem(ownerDb, project, admin, {
        name: `Item ${index + 1}`,
      })
      responses.push(await addResponse(ownerDb, round, item, admin))
    }

    const codebook = await loadCodebookVersion(project, codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria).map((cell) => ({
      definitionId: cell.definition.id,
      criterionId: cell.criterion.id,
      definitionTitle: cell.definition.title,
      criterionName: cell.criterion.name,
    }))

    return { project, round, responses, cells }
  }

  function cellOf(scene: Scene, definition: string, criterion: string): SceneCell {
    const found = scene.cells.find(
      (cell) =>
        cell.definitionTitle === definition && cell.criterionName === criterion,
    )
    expect(found).toBeTruthy()
    return found!
  }

  function note(
    scene: Scene,
    definition: string,
    criterion: string,
    value: CellFixture['value'],
    justification: string | null = null,
  ): CellFixture {
    const { definitionId, criterionId } = cellOf(scene, definition, criterion)
    return { definitionId, criterionId, value, justification }
  }

  async function newEvaluator(project: string, name: string): Promise<string> {
    return addActiveEvaluator(ownerDb, project, await newUser(name))
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('mostra todas as células da resposta, e só as divergentes carregam rótulo de divergência', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(scene.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana, {
      cells: [
        note(scene, 'Informacional', 'Precisão', 'high'),
        note(scene, 'Informacional', 'Clareza', 'high'),
        note(scene, 'Transacional', 'Acionabilidade', 'high'),
        note(scene, 'Transacional', 'Clareza', 'high'),
      ],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: [
        note(scene, 'Informacional', 'Precisão', 'medium'),
        note(scene, 'Informacional', 'Clareza', 'high'),
        note(scene, 'Transacional', 'Acionabilidade', 'low'),
        note(scene, 'Transacional', 'Clareza', 'high'),
      ],
    })

    auth.userId = admin
    const tree = await render(scene.project, scene.round)
    const text = listTextOf(tree)

    expect(text).toContain('Informacional')
    expect(text).toContain('Transacional')
    expect(text).toContain('Precisão')
    expect(text).toContain('Acionabilidade')
    expect(text).toContain('Clareza')

    expect(text).toContain(divergenceLabel('adjacent'))
    expect(text).toContain(divergenceLabel('extreme'))
    expect(text).toContain(divergenceLabel('unanimous'))
    expect(textOf(tree)).toContain('2 de 4 células divergem')
  })

  it('distingue divergência adjacente de extrema e explica a diferença na legenda', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(scene.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana, {
      cells: [
        note(scene, 'Informacional', 'Precisão', 'high'),
        note(scene, 'Transacional', 'Acionabilidade', 'high'),
      ],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: [
        note(scene, 'Informacional', 'Precisão', 'medium'),
        note(scene, 'Transacional', 'Acionabilidade', 'low'),
      ],
    })

    auth.userId = admin
    const tree = await render(scene.project, scene.round)
    const { groups } = listOf(tree)

    const kindOf = (definition: string, criterion: string) =>
      groups
        .find((group) => group.definition.title === definition)!
        .cells.find((cell) => cell.criterion.name === criterion)!.divergence

    expect(kindOf('Informacional', 'Precisão')).toBe('adjacent')
    expect(kindOf('Transacional', 'Acionabilidade')).toBe('extreme')
    expect(divergenceLabel('adjacent')).not.toBe(divergenceLabel('extreme'))

    const text = listTextOf(tree)
    expect(text).toContain(divergenceLabel('adjacent'))
    expect(text).toContain(divergenceLabel('extreme'))
    expect(text).toContain(DIVERGENCE_LEGEND)
  })

  it('cada nota vem com o nome real de quem a deu', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(scene.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: [note(scene, 'Informacional', 'Precisão', 'low')],
    })

    auth.userId = admin
    const text = listTextOf(await render(scene.project, scene.round))

    expect(text).toContain('Ana Avaliadora')
    expect(text).toContain('Bruno Avaliador')
  })

  it('a justificativa aparece quando existe, e a ausência é dita por extenso', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newEvaluator(scene.project, 'Ana Avaliadora')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana, {
      cells: [
        note(
          scene,
          'Informacional',
          'Precisão',
          'high',
          'A resposta cita a fonte e não inventa número.',
        ),
        note(scene, 'Informacional', 'Clareza', 'medium'),
      ],
    })

    auth.userId = admin
    const text = listTextOf(await render(scene.project, scene.round))

    expect(text).toContain('A resposta cita a fonte e não inventa número.')
    expect(text).toContain(NO_JUSTIFICATION_LABEL)
  })

  it('a nota de quem foi desativado continua na revisão, com o nome dele', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(scene.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: [note(scene, 'Informacional', 'Precisão', 'low')],
    })

    await ownerDb
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(eq(projectMembers.id, bruno))

    auth.userId = admin
    const text = listTextOf(await render(scene.project, scene.round))

    expect(text).toContain('Bruno Avaliador')
    expect(text).toContain(divergenceLabel('extreme'))
  })

  it('o rótulo da resposta segue a ordem de criação, e a navegação anda nessa ordem', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 3)

    auth.userId = admin
    const second = await render(scene.project, scene.round, scene.responses[1])

    const at = (response: string) => route(scene.project, scene.round, response)

    expect(textOf(second)).toContain('Resposta 2')
    expect(navOf(second)).toEqual({
      prev: at(scene.responses[0]),
      next: at(scene.responses[2]),
    })

    const first = await render(scene.project, scene.round, scene.responses[0])
    expect(textOf(first)).toContain('Resposta 1')
    expect(navOf(first)).toEqual({ prev: null, next: at(scene.responses[1]) })

    const third = await render(scene.project, scene.round, scene.responses[2])
    expect(textOf(third)).toContain('Resposta 3')
    expect(navOf(third)).toEqual({ prev: at(scene.responses[1]), next: null })
  })

  it('sem parâmetro, ou com id que não é daquela rodada, cai na primeira resposta', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2)
    const other = await roundWith(admin, 1, { roundNumber: 2 })

    auth.userId = admin

    const first = {
      prev: null,
      next: route(scene.project, scene.round, scene.responses[1]),
    }

    expect(navOf(await render(scene.project, scene.round))).toEqual(first)
    expect(
      navOf(await render(scene.project, scene.round, other.responses[0])),
    ).toEqual(first)
  })

  it('a rodada aberta não abre a revisão: explica que ela abre no fechamento', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1, { status: 'open' })
    const ana = await newEvaluator(scene.project, 'Ana Avaliadora')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })

    auth.userId = admin
    const tree = await render(scene.project, scene.round)
    const text = textOf(tree)

    expect(text).toContain('abre quando ela fechar')
    expect(text).not.toContain('Ana Avaliadora')
    expect(findElement(tree, ReviewGroupsList)).toBeNull()
    expect(findElement(tree, QueueNav)).toBeNull()
  })

  it('a rodada fechada sem resposta diz isso, em vez de montar uma tela vazia', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 0)

    auth.userId = admin
    const tree = await render(scene.project, scene.round)

    expect(textOf(tree)).toContain('sem nenhuma resposta gerada')
    expect(findElement(tree, ReviewGroupsList)).toBeNull()
    expect(findElement(tree, QueueNav)).toBeNull()
  })

  it('rodada de outro projeto, e id que não é UUID, são indistinguíveis de inexistente', async () => {
    const admin = await newUser('Admin')
    const mine = await roundWith(admin, 1)
    const theirs = await roundWith(admin, 1)

    auth.userId = admin
    await expect(render(mine.project, theirs.round)).rejects.toThrow('NEXT_NOTFOUND')
    await expect(render(mine.project, 'nao-e-uuid')).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('quem não é membro do projeto não alcança a revisão', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const stranger = await newUser('Estranho')

    auth.userId = stranger
    await expect(render(scene.project, scene.round)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('a revisão não fala de coeficiente, nem para o Administrador', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(scene.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: [note(scene, 'Informacional', 'Precisão', 'low')],
    })

    auth.userId = admin
    const tree = await render(scene.project, scene.round)
    const text = `${textOf(tree)} ${listTextOf(tree)}`

    expect(text).toContain('Ana Avaliadora')
    for (const word of ['Krippendorff', 'ICR', 'Alpha', 'Concordância']) {
      expect(text).not.toContain(word)
    }
    expect(findElement(tree, AgreementPanel)).toBeNull()
    expect(findElement(tree, AgreementMatrixTable)).toBeNull()
  })
})
