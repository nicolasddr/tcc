import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

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

import ProjectRoundsPage from '@/app/projects/[id]/(tabs)/rounds/page'
import { RoundList } from '@/app/projects/[id]/(tabs)/rounds/round-list'
import { EvaluatorRounds } from '@/app/projects/[id]/(tabs)/rounds/evaluator-rounds'
import { NewRound } from '@/app/projects/[id]/(tabs)/rounds/new-round'
import { CloseRound } from '@/app/projects/[id]/(tabs)/rounds/close-round'
import { GenerateResponses } from '@/app/projects/[id]/(tabs)/rounds/generate-responses'
import {
  AgreementPanel,
  AgreementValue,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-panel'
import { AgreementMatrixTable } from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix-table'
import { QualityMatrixTable } from '@/app/projects/[id]/(tabs)/rounds/quality-matrix-table'
import {
  QualityPanel,
  QualityValue,
} from '@/app/projects/[id]/(tabs)/rounds/quality-panel'
import {
  QUALITY_MATRIX_LEGEND,
  QUALITY_UNRATED,
  QUALITY_UNRATED_WITHOUT_OUTLIERS,
} from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_SOURCE,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  CELL_NOT_APPLICABLE,
  CELL_NOT_APPLICABLE_TITLE,
  CELL_UNRATED_LABEL,
  MATRIX_SCOPE_NOTE,
  OUTLIER_PAIR_SUMMARY,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { Section } from '@/app/components/ui/section'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { formatDate } from '@/app/notifications/labels'
import { PHASE_1, PHASE_2, PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'
import {
  closeConfirmationLines,
  pendingEvaluatorsTitle,
  roundBlockerMessage,
  roundInputSummary,
} from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { itemUsageLabel } from '@/app/projects/[id]/pipeline/item-usage'
import { llmModel } from '@/lib/ai'
import { ownerDb, projectMembers } from '@/lib/db'
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
  addOutlier,
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

function findSection(node: unknown, type: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findSection(child, type)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const props = node.props as Record<string, unknown>
  if (node.type === Section && findElement(props.children, type)) return node
  for (const value of Object.values(props)) {
    const found = findSection(value, type)
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

// O ramo do Avaliador põe texto fora de `children` — a dica da seção é prop —, e é
// justamente ali que um coeficiente vazaria sem ninguém ver.
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

function allTextOf(node: unknown): string {
  return deepText(node).replace(/\s+/g, ' ').trim()
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
  codebookVersion: string
  round: string
  responses: string[]
  cells: SceneCell[]
}

type ListProps = Parameters<typeof RoundList>[0]
type NewRoundProps = Parameters<typeof NewRound>[0]
type CloseRoundProps = Parameters<typeof CloseRound>[0]
type GenerateProps = Parameters<typeof GenerateResponses>[0]
type PanelProps = Parameters<typeof AgreementPanel>[0]
type MatrixProps = Parameters<typeof AgreementMatrixTable>[0]
type EvaluatorProps = Parameters<typeof EvaluatorRounds>[0]
type QualityProps = Parameters<typeof QualityPanel>[0]
type QualityMatrixProps = Parameters<typeof QualityMatrixTable>[0]

function render(id: string) {
  return ProjectRoundsPage({ params: Promise.resolve({ id }) })
}

function listOf(tree: unknown): ListProps {
  const element = findElement(tree, RoundList)
  expect(element).toBeTruthy()
  return element!.props as ListProps
}

function newRoundOf(tree: unknown): NewRoundProps {
  const element = findElement(tree, NewRound)
  expect(element).toBeTruthy()
  return element!.props as NewRoundProps
}

function closeRoundOf(tree: unknown): CloseRoundProps {
  const element = findElement(tree, CloseRound)
  expect(element).toBeTruthy()
  return element!.props as CloseRoundProps
}

function generateOf(tree: unknown): GenerateProps {
  const element = findElement(tree, GenerateResponses)
  expect(element).toBeTruthy()
  return element!.props as GenerateProps
}

function panelOf(tree: unknown): PanelProps {
  const element = findElement(tree, AgreementPanel)
  expect(element).toBeTruthy()
  return element!.props as PanelProps
}

function matrixOf(tree: unknown): MatrixProps {
  const element = findElement(tree, AgreementMatrixTable)
  expect(element).toBeTruthy()
  return element!.props as MatrixProps
}

function evaluatorRoundsOf(tree: unknown): EvaluatorProps {
  const element = findElement(tree, EvaluatorRounds)
  expect(element).toBeTruthy()
  return element!.props as EvaluatorProps
}

function qualityPanelOf(tree: unknown): QualityProps {
  const element = findElement(tree, QualityPanel)
  expect(element).toBeTruthy()
  return element!.props as QualityProps
}

function qualityMatrixOf(tree: unknown): QualityMatrixProps {
  const element = findElement(tree, QualityMatrixTable)
  expect(element).toBeTruthy()
  return element!.props as QualityMatrixProps
}

function markupTextOf(element: ReactElement): string {
  return renderToStaticMarkup(element)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function panelTextOf(tree: unknown): string {
  return markupTextOf(createElement(AgreementPanel, panelOf(tree)))
}

function qualityTextOf(tree: unknown): string {
  return markupTextOf(createElement(QualityPanel, qualityPanelOf(tree)))
}

function classNamesOf(element: ReactElement): string[] {
  return [...renderToStaticMarkup(element).matchAll(/class="([^"]*)"/g)].map(
    (match) => match[1],
  )
}

function matrixTextOf(tree: unknown): string {
  return markupTextOf(createElement(AgreementMatrixTable, matrixOf(tree)))
}

function qualityMatrixTextOf(tree: unknown): string {
  return markupTextOf(createElement(QualityMatrixTable, qualityMatrixOf(tree)))
}

function qualityCellsOf(tree: unknown): string[] {
  const markup = renderToStaticMarkup(
    createElement(QualityMatrixTable, qualityMatrixOf(tree)),
  )
  return [...markup.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((match) =>
    match[1]
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function agreementTitleOf(tree: unknown): string {
  const section = findSection(tree, AgreementMatrixTable)
  expect(section).toBeTruthy()
  return textOf((section!.props as { title: ReactNode }).title)
}

describe('app/projects/[id]/rounds — a área de rodadas do projeto', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  const ONE_DEFINITION: CodebookShape = {
    definitions: [
      { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
    ],
  }

  const TWO_DEFINITIONS: CodebookShape = {
    definitions: [
      { title: 'Informacional', type: 'category' },
      { title: 'Transacional', type: 'category' },
    ],
    generalCriteria: [{ name: 'Clareza' }],
  }

  async function readyProject(
    admin: string,
    phase = PHASE_2,
    shape: CodebookShape = ONE_DEFINITION,
  ): Promise<{ project: string; codebookVersion: string; promptVersion: string }> {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
    projs.push(project)
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, shape)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    return { project, codebookVersion, promptVersion }
  }

  async function newEvaluator(project: string, name: string): Promise<string> {
    return addActiveEvaluator(ownerDb, project, await newUser(name))
  }

  async function roundWith(
    admin: string,
    responseCount: number,
    opts: { shape?: CodebookShape; status?: 'open' | 'closed'; phase?: number } = {},
  ): Promise<Scene> {
    const phase = opts.phase ?? PHASE_2
    const { project, codebookVersion, promptVersion } = await readyProject(
      admin,
      phase,
      opts.shape ?? ONE_DEFINITION,
    )
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1, status: opts.status ?? 'open', phase },
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

    return { project, codebookVersion, round, responses, cells }
  }

  function filled(cells: SceneCell[], value: CellFixture['value']): CellFixture[] {
    return cells.map((cell) => ({
      definitionId: cell.definitionId,
      criterionId: cell.criterionId,
      value,
    }))
  }

  async function qualityScene(
    admin: string,
    phase: number,
  ): Promise<{ scene: Scene; ana: string; bruno: string }> {
    const scene = await roundWith(admin, 4, { phase, status: 'closed' })
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const notes = {
      [ana]: ['high', 'high', 'high', 'medium'],
      [bruno]: ['high', 'high', 'medium', 'low'],
    } as const
    for (const evaluator of [ana, bruno]) {
      for (const [index, value] of notes[evaluator].entries()) {
        await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
          cells: filled(scene.cells, value),
        })
      }
    }

    return { scene, ana, bruno }
  }

  function cellsOf(scene: Scene, definitionTitle: string): SceneCell[] {
    return scene.cells.filter((cell) => cell.definitionTitle === definitionTitle)
  }

  const MATRIX_SHAPE: CodebookShape = {
    definitions: [
      {
        title: 'Informacional',
        type: 'category',
        criteria: [{ name: 'Profundidade' }],
      },
      { title: 'Transacional', type: 'category', criteria: [{ name: 'Precisão' }] },
    ],
    generalCriteria: [{ name: 'Clareza' }],
  }

  function note(
    scene: Scene,
    definitionTitle: string,
    criterionName: string,
    value: CellFixture['value'],
  ): CellFixture {
    const cell = scene.cells.find(
      (candidate) =>
        candidate.definitionTitle === definitionTitle &&
        candidate.criterionName === criterionName,
    )
    expect(cell).toBeTruthy()
    return { definitionId: cell!.definitionId, criterionId: cell!.criterionId, value }
  }

  async function qualityMatrixScene(
    admin: string,
    opts: { phase?: number; carla?: boolean } = {},
  ): Promise<{ scene: Scene; carla: string | null }> {
    const scene = await roundWith(admin, 2, {
      shape: MATRIX_SHAPE,
      phase: opts.phase ?? PHASE_3,
      status: 'closed',
    })
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const notes = [
      [ana, 0, ['high', 'high', 'medium']],
      [ana, 1, ['high', 'medium', 'medium']],
      [bruno, 0, ['high', 'low', 'low']],
      [bruno, 1, ['low', 'medium', 'low']],
    ] as const
    for (const [evaluator, index, [clareza, profundidade, transacional]] of notes) {
      await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
        cells: [
          note(scene, 'Informacional', 'Clareza', clareza),
          note(scene, 'Informacional', 'Profundidade', profundidade),
          note(scene, 'Transacional', 'Clareza', transacional),
        ],
      })
    }

    if (!opts.carla) return { scene, carla: null }

    const carla = await newEvaluator(scene.project, 'Carla')
    await addEvaluation(ownerDb, scene.round, scene.responses[0], carla, {
      cells: [note(scene, 'Informacional', 'Clareza', 'low')],
    })
    return { scene, carla }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o projeto sem rodada mostra a lista vazia e o botão de nova rodada liberado', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin)

    auth.userId = admin
    const tree = await render(project)

    const list = listOf(tree)
    expect(list.rounds).toEqual([])
    expect(textOf(RoundList(list))).toContain('Nenhuma rodada ainda')

    const newRound = newRoundOf(tree)
    expect(newRound.blockers).toEqual([])
    expect(newRound.codebookVersionNumber).toBe(1)
    expect(newRound.promptVersionNumber).toBe(1)

    expect(findElement(tree, GenerateResponses)).toBeNull()
  })

  it('a lista mostra número, estado, versões usadas e data de cada rodada', async () => {
    const admin = await newUser('Ana Pesquisadora')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
      status: 'closed',
    })
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 2,
    })

    auth.userId = admin
    const list = listOf(await render(project))
    expect(list.rounds.map((round) => round.roundNumber)).toEqual([1, 2])

    const text = textOf(RoundList(list))
    expect(text).toContain('Rodada 1')
    expect(text).toContain('fechada')
    expect(text).toContain('Rodada 2')
    expect(text).toContain('aberta')
    expect(text).toContain('Codebook v1 · Prompt v1')
    expect(text).toContain(formatDate(list.rounds[1].createdAt))
    expect(text).toContain('Ana Pesquisadora')
  })

  it('a lista mostra a fase de cada rodada, e o painel da rodada aberta diz o que vai à LLM', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(
      admin,
      PHASE_3,
    )
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
      status: 'closed',
      phase: PHASE_2,
    })
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 2,
      phase: PHASE_3,
    })

    auth.userId = admin
    const tree = await render(project)

    const list = listOf(tree)
    expect(list.rounds.map((round) => round.phase)).toEqual([PHASE_2, PHASE_3])
    const text = markupTextOf(createElement(RoundList, list))
    expect(text).toContain(`Rodada 1 · Fase ${PHASE_2}`)
    expect(text).toContain(`Rodada 2 · Fase ${PHASE_3}`)

    const close = closeRoundOf(tree)
    expect(close.round.phase).toBe(PHASE_3)
    const panel = markupTextOf(createElement(CloseRound, close))
    expect(panel).toContain(roundInputSummary(PHASE_3))
    expect(panel).not.toContain(roundInputSummary(PHASE_2))
  })

  it('a tela diz qual definição está sem critério em vez de só desabilitar o botão', async () => {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: PHASE_2,
    })
    projs.push(project)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', type: 'category' },
      ],
    })
    await addPromptVersion(ownerDb, project, admin)

    auth.userId = admin
    const props = newRoundOf(await render(project))
    expect(props.blockers).toEqual([{ key: 'criteria', titles: ['Transacional'] }])
    expect(roundBlockerMessage(props.blockers[0])).toContain('“Transacional”')
  })

  it('na Fase 1 a tela explica que a rodada só começa na Fase 2', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin, PHASE_1)

    auth.userId = admin
    const props = newRoundOf(await render(project))
    const phaseBlocker = props.blockers.find((blocker) => blocker.key === 'phase')
    expect(phaseBlocker).toBeTruthy()
    expect(roundBlockerMessage(phaseBlocker!)).toContain(`Fase ${PHASE_2}`)
  })

  it('com rodada aberta, a tela troca a criação pelo fechamento e diz quem não terminou', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Bia Avaliadora')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )

    auth.userId = admin
    const tree = await render(project)
    expect(findElement(tree, NewRound)).toBeNull()

    const props = closeRoundOf(tree)
    expect(props.round.id).toBe(round)
    expect(props.round.roundNumber).toBe(1)
    expect(props.evaluatorsNotFinished).toEqual(['Bia Avaliadora'])

    expect(closeConfirmationLines(props.round.roundNumber)[0]).toContain(
      'irreversível',
    )
    expect(props.activeEvaluators).toBe(1)
    expect(
      pendingEvaluatorsTitle(props.evaluatorsNotFinished.length, props.activeEvaluators),
    ).toBe('1 avaliador ainda não terminou:')

    const markup = renderToStaticMarkup(createElement(CloseRound, props))
    expect(markup).toContain('name="project_id"')
    expect(markup).toContain(`name="round_id" value="${round}"`)
  })

  it('quem avaliou todas as respostas da rodada aberta sai da lista de quem não terminou', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const anaMember = await addActiveEvaluator(ownerDb, project, ana)
    const brunoMember = await addActiveEvaluator(ownerDb, project, bruno)
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )
    const first = await addResponse(
      ownerDb,
      round,
      await addInputItem(ownerDb, project, admin, { name: 'Item 1' }),
      admin,
    )
    const second = await addResponse(
      ownerDb,
      round,
      await addInputItem(ownerDb, project, admin, { name: 'Item 2' }),
      admin,
    )

    auth.userId = admin
    expect(closeRoundOf(await render(project)).evaluatorsNotFinished).toEqual([
      'Ana',
      'Bruno',
    ])

    await addEvaluation(ownerDb, round, first, anaMember)
    await addEvaluation(ownerDb, round, second, anaMember)
    await addEvaluation(ownerDb, round, first, brunoMember)
    expect(closeRoundOf(await render(project)).evaluatorsNotFinished).toEqual(['Bruno'])

    await addEvaluation(ownerDb, round, second, brunoMember)
    const props = closeRoundOf(await render(project))
    expect(props.evaluatorsNotFinished).toEqual([])
    expect(markupTextOf(createElement(CloseRound, props))).toContain(
      'Todos os avaliadores ativos terminaram.',
    )
  })

  it('com rodada aberta, o seletor recebe os itens, o modelo em uso e as respostas da rodada', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const first = await addInputItem(ownerDb, project, admin, { name: 'Item 1' })
    const second = await addInputItem(ownerDb, project, admin, { name: 'Item 2' })
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )
    await addResponse(ownerDb, round, first, admin)

    auth.userId = admin
    const props = generateOf(await render(project))

    expect(props.round.id).toBe(round)
    expect(props.round.roundNumber).toBe(1)
    expect(props.model).toBe(llmModel())
    expect(props.items.map((item) => item.id)).toEqual([first, second])
    expect(props.generated).toHaveLength(1)
    expect(props.generated[0].itemId).toBe(first)
    expect(props.generated[0].itemName).toBe('Item 1')
    expect(formatDate(props.generated[0].createdAt)).toBeTruthy()
  })

  it('o seletor diz em quais rodadas cada item já produziu resposta, sem tirar ninguém da lista', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const reused = await addInputItem(ownerDb, project, admin, { name: 'Item reaproveitado' })
    const fresh = await addInputItem(ownerDb, project, admin, { name: 'Item novo' })
    const closed = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1, status: 'closed' },
    )
    const open = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 2 },
    )
    await addResponse(ownerDb, closed, reused, admin)
    await addResponse(ownerDb, open, reused, admin)

    auth.userId = admin
    const props = generateOf(await render(project))

    expect(props.items.map((item) => item.id)).toEqual([reused, fresh])
    expect(props.items.map((item) => item.roundNumbers)).toEqual([[1, 2], []])
    expect(itemUsageLabel(props.items[0].roundNumbers)).toBe('usado nas rodadas 1, 2')
    expect(itemUsageLabel(props.items[1].roundNumbers)).toBeNull()
    expect(props.generated.map((response) => response.itemId)).toEqual([reused])
  })

  it('com dois avaliadores concordando, o painel dá o valor, o N, a faixa e a origem', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 3)
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const values = ['low', 'medium', 'high'] as const
    for (const [index, value] of values.entries()) {
      for (const evaluator of [ana, bruno]) {
        await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
          cells: filled(scene.cells, value),
        })
      }
    }

    auth.userId = admin
    const tree = await render(scene.project)

    const props = panelOf(tree)
    expect(props.pair).toEqual({
      all: { calculable: true, alpha: 1, units: 3, raters: 2 },
      withoutOutliers: null,
      excluded: 0,
    })
    expect(props.responses).toEqual({ all: 3, withoutOutliers: 3 })

    const text = panelTextOf(tree)
    expect(text).toContain('Concordância (ICR)')
    expect(text).toContain('1,000')
    expect(text).toContain('3 unidades · 2 avaliadores')
    expect(text).toContain('boa')
    expect(text).toContain(AGREEMENT_SOURCE)
    expect(text).toContain('não trava')
  })

  it('com um avaliador só, o painel diz não calculável, o motivo e o N que tem', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2)
    const ana = await newEvaluator(scene.project, 'Ana')

    for (const response of scene.responses) {
      await addEvaluation(ownerDb, scene.round, response, ana, {
        cells: filled(scene.cells, 'high'),
      })
    }

    auth.userId = admin
    const tree = await render(scene.project)

    expect(panelOf(tree).pair.all).toEqual({
      calculable: false,
      reason: 'few_evaluators',
      units: 0,
      raters: 1,
    })
    expect(panelOf(tree).pair.withoutOutliers).toBeNull()

    const text = panelTextOf(tree)
    expect(text).toContain('não calculável')
    expect(text).toContain('Menos de dois avaliadores')
    expect(text).toContain('0 unidades · 1 avaliador')
  })

  it('a amostra pequena avisa sem esconder o número', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2)
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const values = ['low', 'high'] as const
    for (const [index, value] of values.entries()) {
      for (const evaluator of [ana, bruno]) {
        await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
          cells: filled(scene.cells, value),
        })
      }
    }

    auth.userId = admin
    const text = panelTextOf(await render(scene.project))

    expect(text).toContain('Amostra pequena')
    expect(text).toContain('1,000')
    expect(text).toContain('2 unidades · 2 avaliadores')
  })

  it('o esforço por avaliador mostra a contagem de cada um, inclusive quem enviou zero', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 3)
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')
    await newEvaluator(scene.project, 'Carla')

    for (const response of scene.responses) {
      await addEvaluation(ownerDb, scene.round, response, ana, {
        cells: filled(scene.cells, 'high'),
      })
    }
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: filled(scene.cells, 'medium'),
    })

    auth.userId = admin
    const tree = await render(scene.project)

    expect(panelOf(tree).effort.map((row) => [row.name, row.submitted])).toEqual([
      ['Ana', 3],
      ['Bruno', 1],
      ['Carla', 0],
    ])

    const text = panelTextOf(tree)
    expect(text).toContain('Ana 3 avaliações enviadas')
    expect(text).toContain('Bruno 1 avaliação enviada')
    expect(text).toContain('Carla 0 avaliações enviadas')
  })

  it('com alguém marcado, o painel mostra os dois valores e quem saiu, com a justificativa', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 3)
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')
    const carla = await newEvaluator(scene.project, 'Carla')

    const agree = ['low', 'medium', 'high'] as const
    const destoa = ['high', 'low', 'medium'] as const
    for (const [index, value] of agree.entries()) {
      for (const evaluator of [ana, bruno]) {
        await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
          cells: filled(scene.cells, value),
        })
      }
      await addEvaluation(ownerDb, scene.round, scene.responses[index], carla, {
        cells: filled(scene.cells, destoa[index]),
      })
    }

    await addOutlier(ownerDb, scene.round, carla, admin, {
      reason: 'Pontuou em sentido oposto ao grupo em toda a rodada.',
    })

    auth.userId = admin
    const tree = await render(scene.project)

    const props = panelOf(tree)
    expect(props.pair.excluded).toBe(1)
    expect(props.pair.all).toMatchObject({ raters: 3 })
    expect(props.pair.withoutOutliers).toMatchObject({
      calculable: true,
      alpha: 1,
      raters: 2,
    })
    expect(props.outliers.map((mark) => mark.evaluatorName)).toEqual(['Carla'])
    expect(props.responses).toEqual({ all: 3, withoutOutliers: 3 })

    const text = panelTextOf(tree)
    expect(text).toContain(AGREEMENT_ALL_LABEL)
    expect(text).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(text).toContain('1,000')
    expect(text).toContain('Carla')
    expect(text).toContain('Pontuou em sentido oposto ao grupo')
  })

  it('a matriz por célula diz que é calculada com todos, inclusive os marcados', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2)
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const values = ['low', 'high'] as const
    for (const [index, value] of values.entries()) {
      for (const evaluator of [ana, bruno]) {
        await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
          cells: filled(scene.cells, value),
        })
      }
    }
    await addOutlier(ownerDb, scene.round, bruno, admin)

    auth.userId = admin
    expect(matrixTextOf(await render(scene.project))).toContain(MATRIX_SCOPE_NOTE)
  })

  it('o avaliador desativado que avaliou a rodada continua no esforço, marcado como desativado', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2)
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    for (const response of scene.responses) {
      for (const evaluator of [ana, bruno]) {
        await addEvaluation(ownerDb, scene.round, response, evaluator, {
          cells: filled(scene.cells, 'high'),
        })
      }
    }

    await ownerDb
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(eq(projectMembers.id, bruno))

    auth.userId = admin
    const tree = await render(scene.project)

    expect(panelOf(tree).effort.map((row) => [row.name, row.status])).toEqual([
      ['Ana', 'active'],
      ['Bruno', 'inactive'],
    ])
    expect(panelTextOf(tree)).toContain('desativado')
  })

  it('a lista de rodadas traz o coeficiente ao lado das versões que ele mede', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2)
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const values = ['low', 'high'] as const
    for (const [index, value] of values.entries()) {
      for (const evaluator of [ana, bruno]) {
        await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
          cells: filled(scene.cells, value),
        })
      }
    }

    auth.userId = admin
    const list = listOf(await render(scene.project))

    expect(list.agreement.get(scene.round)).toEqual({
      all: { calculable: true, alpha: 1, units: 2, raters: 2 },
      withoutOutliers: null,
      excluded: 0,
    })

    const rendered = RoundList(list)
    expect(textOf(rendered)).toContain('Codebook v1 · Prompt v1')

    const value = findElement(rendered, AgreementValue)
    expect(value).toBeTruthy()

    const text = markupTextOf(value!)
    expect(text).toContain('Concordância (ICR): 1,000')
    expect(text).toContain('boa')
    expect(text).toContain('2 unidades · 2 avaliadores')
  })

  it('numa rodada da Fase 3, o Administrador vê a Qualidade com porcentagem e contagem', async () => {
    const admin = await newUser('Admin')
    const { scene } = await qualityScene(admin, PHASE_3)

    auth.userId = admin
    const tree = await render(scene.project)

    const pair = qualityPanelOf(tree).pair
    expect(pair.withoutOutliers).toBeNull()
    expect(pair.all).toEqual({
      rated: true,
      total: 8,
      levels: [
        { value: 'high', count: 5, share: 0.625 },
        { value: 'medium', count: 2, share: 0.25 },
        { value: 'low', count: 1, share: 0.125 },
      ],
    })

    const text = qualityTextOf(tree)
    expect(text).toContain('Qualidade')
    expect(text).toContain('8 notas')
    expect(text).toContain('Alto 62,5% · 5 notas')
    expect(text).toContain('Médio 25% · 2 notas')
    expect(text).toContain('Baixo 12,5% · 1 nota')

    const section = findSection(tree, QualityPanel)
    expect(textOf((section!.props as { title: ReactNode }).title)).toBe(
      'Qualidade na rodada 1, fechada',
    )
  })

  it('numa rodada da Fase 2, a Qualidade não aparece e o ICR continua', async () => {
    const admin = await newUser('Admin')
    const { scene } = await qualityScene(admin, PHASE_2)

    auth.userId = admin
    const tree = await render(scene.project)

    expect(findElement(tree, QualityPanel)).toBeNull()
    expect(panelOf(tree).pair.all).toMatchObject({ calculable: true })

    const list = listOf(tree)
    expect(list.quality.has(scene.round)).toBe(false)
    expect(allTextOf(tree)).not.toContain('Qualidade')
    expect(markupTextOf(createElement(RoundList, list))).not.toContain('Qualidade')
  })

  it('a Qualidade é um bloco separado do ICR, e o painel do ICR não recebe nada dela', async () => {
    const admin = await newUser('Admin')
    const { scene } = await qualityScene(admin, PHASE_3)

    auth.userId = admin
    const tree = await render(scene.project)

    const qualitySection = findSection(tree, QualityPanel)
    const agreementSection = findSection(tree, AgreementPanel)
    expect(qualitySection).toBeTruthy()
    expect(agreementSection).toBeTruthy()
    expect(qualitySection).not.toBe(agreementSection)
    expect(findElement(agreementSection, QualityPanel)).toBeNull()
    expect(findElement(qualitySection, AgreementPanel)).toBeNull()

    expect(Object.keys(panelOf(tree)).sort()).toEqual([
      'effort',
      'outliers',
      'pair',
      'responses',
    ])
    expect(Object.keys(panelOf(tree).pair).sort()).toEqual([
      'all',
      'excluded',
      'withoutOutliers',
    ])
  })

  it('a rodada da Fase 3 sem nota diz que não há notas, e nunca 0%', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2, { phase: PHASE_3 })

    auth.userId = admin
    const tree = await render(scene.project)

    expect(qualityPanelOf(tree).pair).toEqual({
      all: { rated: false, total: 0 },
      withoutOutliers: null,
      excluded: 0,
    })
    const text = qualityTextOf(tree)
    expect(text).toContain(QUALITY_UNRATED)
    expect(text).not.toContain('0%')

    const value = findElement(RoundList(listOf(tree)), QualityValue)
    expect(markupTextOf(value!)).toContain(`Qualidade: ${QUALITY_UNRATED}`)
    expect(markupTextOf(value!)).not.toContain('0%')
  })

  it('com alguém marcado, a Qualidade mostra os dois valores, o com todos primeiro', async () => {
    const admin = await newUser('Admin')
    const { scene, bruno } = await qualityScene(admin, PHASE_3)
    await addOutlier(ownerDb, scene.round, bruno, admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const pair = qualityPanelOf(tree).pair
    expect(pair.excluded).toBe(1)
    expect(pair.all).toMatchObject({ rated: true, total: 8 })
    expect(pair.withoutOutliers).toEqual({
      rated: true,
      total: 4,
      levels: [
        { value: 'high', count: 3, share: 0.75 },
        { value: 'medium', count: 1, share: 0.25 },
        { value: 'low', count: 0, share: 0 },
      ],
    })

    const text = qualityTextOf(tree)
    const allAt = text.indexOf(`Qualidade — ${AGREEMENT_ALL_LABEL}`)
    const withoutAt = text.indexOf(`Qualidade — ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`)
    expect(allAt).toBeGreaterThanOrEqual(0)
    expect(withoutAt).toBeGreaterThan(allAt)
    expect(text).toContain('Alto 75% · 3 notas')
    expect(text).toContain('1 avaliador fora')
    expect(text).toContain(OUTLIER_PAIR_SUMMARY)

    const value = markupTextOf(findElement(RoundList(listOf(tree)), QualityValue)!)
    expect(value).toContain(
      `Qualidade ${AGREEMENT_ALL_LABEL}: Alto 62,5% (5) · Médio 25% (2) · Baixo 12,5% (1)`,
    )
    expect(value).toContain(
      `${AGREEMENT_WITHOUT_OUTLIERS_LABEL}: Alto 75% (3) · Médio 25% (1) · Baixo 0% (0)`,
    )
  })

  it('com todo mundo marcado, a Qualidade diz que não sobra nota e mantém o com todos', async () => {
    const admin = await newUser('Admin')
    const { scene, ana, bruno } = await qualityScene(admin, PHASE_3)
    await addOutlier(ownerDb, scene.round, ana, admin)
    await addOutlier(ownerDb, scene.round, bruno, admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const pair = qualityPanelOf(tree).pair
    expect(pair.all).toMatchObject({ rated: true, total: 8 })
    expect(pair.withoutOutliers).toEqual({ rated: false, total: 0 })

    const text = qualityTextOf(tree)
    expect(text).toContain('Alto 62,5% · 5 notas')
    expect(text).toContain(QUALITY_UNRATED_WITHOUT_OUTLIERS)
  })

  it('a Qualidade não usa cor de juízo em nenhum elemento', async () => {
    const admin = await newUser('Admin')
    const { scene, bruno } = await qualityScene(admin, PHASE_3)
    await addOutlier(ownerDb, scene.round, bruno, admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const classes = [
      ...classNamesOf(createElement(QualityPanel, qualityPanelOf(tree))),
      ...classNamesOf(findElement(RoundList(listOf(tree)), QualityValue)!),
    ]
    expect(classes.length).toBeGreaterThan(0)
    for (const className of classes) {
      for (const tone of ['success', 'warning', 'danger', 'brand']) {
        expect(className).not.toContain(tone)
      }
    }

    const bars = renderToStaticMarkup(createElement(QualityPanel, qualityPanelOf(tree)))
      .match(/class="h-full rounded-full [^"]*"/g)
    expect(bars).toHaveLength(6)
    expect(new Set(bars).size).toBe(1)
  })

  it('numa rodada da Fase 3, o Administrador vê a matriz de Qualidade da versão fixada', async () => {
    const admin = await newUser('Admin')
    const { scene } = await qualityMatrixScene(admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const codebook = await loadCodebookVersion(scene.project, scene.codebookVersion)
    const props = qualityMatrixOf(tree)
    expect(props.definitions).toEqual(codebook!.definitions)
    expect(props.criteria).toEqual(codebook!.criteria)
    expect(props.codebookVersionNumber).toBe(1)
    expect(props.excluded.size).toBe(0)

    const cells = qualityCellsOf(tree)
    expect(cells).toHaveLength(6)
    expect(cells[0]).toBe('Alto 75% (3) Médio 0% (0) Baixo 25% (1)')
    expect(cells[1]).toBe('Alto 25% (1) Médio 50% (2) Baixo 25% (1)')
    expect(cells[3]).toBe('Alto 0% (0) Médio 50% (2) Baixo 50% (2)')

    const text = qualityMatrixTextOf(tree)
    expect(text).toContain('Informacional')
    expect(text).toContain('Transacional')
    expect(text.indexOf('Clareza')).toBeLessThan(text.indexOf('Profundidade'))
    expect(text.indexOf('Profundidade')).toBeLessThan(text.indexOf('Precisão'))
    expect(text).toContain('Codebook v1')
  })

  it('na matriz de Qualidade, o par inexistente é traço e a célula sem nota diz sem nota, nunca 0%', async () => {
    const admin = await newUser('Admin')
    const { scene } = await qualityMatrixScene(admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const cells = qualityCellsOf(tree)
    expect(cells[2]).toBe(CELL_NOT_APPLICABLE)
    expect(cells[4]).toBe(CELL_NOT_APPLICABLE)
    expect(cells[5]).toBe(CELL_UNRATED_LABEL)
    expect(cells[5]).not.toContain('%')

    const markup = renderToStaticMarkup(
      createElement(QualityMatrixTable, qualityMatrixOf(tree)),
    )
    expect(markup.split(`title="${CELL_NOT_APPLICABLE_TITLE}"`)).toHaveLength(3)
    expect(markup).toContain(`aria-label="${QUALITY_MATRIX_LEGEND}"`)
  })

  it('a matriz de Qualidade fica no bloco da Qualidade, e a de Concordância no dela, sem prop nova', async () => {
    const admin = await newUser('Admin')
    const { scene } = await qualityMatrixScene(admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const qualitySection = findSection(tree, QualityMatrixTable)
    expect(qualitySection).toBeTruthy()
    expect(qualitySection).toBe(findSection(tree, QualityPanel))
    expect(findElement(qualitySection, AgreementMatrixTable)).toBeNull()

    const agreementSection = findSection(tree, AgreementMatrixTable)
    expect(agreementSection).toBe(findSection(tree, AgreementPanel))
    expect(findElement(agreementSection, QualityMatrixTable)).toBeNull()
    expect(Object.keys(matrixOf(tree)).sort()).toEqual([
      'codebookVersionNumber',
      'criteria',
      'definitions',
      'observations',
    ])
  })

  it('numa rodada da Fase 2, a matriz de Qualidade não existe e a de Concordância continua', async () => {
    const admin = await newUser('Admin')
    const { scene } = await qualityMatrixScene(admin, { phase: PHASE_2 })

    auth.userId = admin
    const tree = await render(scene.project)

    expect(findElement(tree, QualityMatrixTable)).toBeNull()
    expect(matrixOf(tree).codebookVersionNumber).toBe(1)
    expect(matrixTextOf(tree)).toContain('Profundidade')
  })

  it('com alguém marcado, cada célula medida da matriz de Qualidade traz o par, o com todos primeiro', async () => {
    const admin = await newUser('Admin')
    const { scene, carla } = await qualityMatrixScene(admin, { carla: true })
    await addOutlier(ownerDb, scene.round, carla!, admin)

    auth.userId = admin
    const tree = await render(scene.project)

    expect(qualityMatrixOf(tree).excluded.size).toBe(1)

    const cells = qualityCellsOf(tree)
    expect(cells[0]).toBe(
      `${AGREEMENT_ALL_LABEL} Alto 60% (3) Médio 0% (0) Baixo 40% (2) ` +
        `${AGREEMENT_WITHOUT_OUTLIERS_LABEL} Alto 75% (3) Médio 0% (0) Baixo 25% (1)`,
    )
    expect(cells[1]).toBe(
      `${AGREEMENT_ALL_LABEL} Alto 25% (1) Médio 50% (2) Baixo 25% (1) ` +
        `${AGREEMENT_WITHOUT_OUTLIERS_LABEL} Alto 25% (1) Médio 50% (2) Baixo 25% (1)`,
    )
    expect(cells[5]).toBe(CELL_UNRATED_LABEL)
  })

  it('sem ninguém marcado, a matriz de Qualidade não traz os rótulos do par', async () => {
    const admin = await newUser('Admin')
    const { scene } = await qualityMatrixScene(admin, { carla: true })

    auth.userId = admin
    const cells = qualityCellsOf(await render(scene.project))

    expect(cells[0]).toBe('Alto 60% (3) Médio 0% (0) Baixo 40% (2)')
    for (const cell of cells) {
      expect(cell).not.toContain(AGREEMENT_ALL_LABEL)
      expect(cell).not.toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    }
  })

  it('a célula avaliada só pelo marcado diz que não sobra nota, ao lado do com todos', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1, { shape: MATRIX_SHAPE, phase: PHASE_3 })
    const ana = await newEvaluator(scene.project, 'Ana')
    const carla = await newEvaluator(scene.project, 'Carla')
    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana, {
      cells: [note(scene, 'Informacional', 'Clareza', 'high')],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], carla, {
      cells: [note(scene, 'Transacional', 'Clareza', 'low')],
    })
    await addOutlier(ownerDb, scene.round, carla, admin)

    auth.userId = admin
    const cells = qualityCellsOf(await render(scene.project))

    expect(cells[3]).toBe(
      `${AGREEMENT_ALL_LABEL} Alto 0% (0) Médio 0% (0) Baixo 100% (1) ` +
        `${AGREEMENT_WITHOUT_OUTLIERS_LABEL} ${QUALITY_UNRATED_WITHOUT_OUTLIERS}`,
    )
  })

  it('a matriz de Qualidade é da versão de codebook que a rodada fixou, e não da vigente', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1, { phase: PHASE_3 })
    await addCodebookVersion(ownerDb, scene.project, admin, {
      versionNumber: 2,
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
        { title: 'Navegacional', type: 'category', criteria: [{ name: 'Profundidade' }] },
      ],
    })

    auth.userId = admin
    const tree = await render(scene.project)

    const props = qualityMatrixOf(tree)
    expect(props.codebookVersionNumber).toBe(1)
    expect(props.definitions.map((definition) => definition.title)).toEqual([
      'Informacional',
    ])

    const text = qualityMatrixTextOf(tree)
    expect(text).toContain('Clareza')
    expect(text).not.toContain('Navegacional')
    expect(text).not.toContain('Profundidade')
    expect(text).toContain('Codebook v1')
  })

  it('a matriz de Qualidade não usa cor de juízo em nenhum elemento', async () => {
    const admin = await newUser('Admin')
    const { scene, carla } = await qualityMatrixScene(admin, { carla: true })
    await addOutlier(ownerDb, scene.round, carla!, admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const tokens = classNamesOf(createElement(QualityMatrixTable, qualityMatrixOf(tree)))
      .flatMap((className) => className.split(/\s+/))
      .filter((token) => !token.startsWith('focus-visible:'))
    expect(tokens.length).toBeGreaterThan(0)
    for (const token of tokens) {
      for (const tone of ['success', 'warning', 'danger', 'brand']) {
        expect(token).not.toContain(tone)
      }
    }
  })

  it('a lista de rodadas mostra a Qualidade só nas rodadas da Fase 3', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(
      admin,
      PHASE_3,
    )
    const phase2 = await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
      status: 'closed',
      phase: PHASE_2,
    })
    const phase3 = await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
    })

    auth.userId = admin
    const list = listOf(await render(project))

    expect([...list.quality.keys()]).toEqual([phase3])
    expect(list.agreement.has(phase2)).toBe(true)

    const rendered = RoundList(list)
    const values: ReactElement[] = []
    const cards = (rendered.props as { children: ReactElement[] }).children
    for (const card of cards) {
      const value = findElement(card, QualityValue)
      if (value) values.push(value)
    }
    expect(values).toHaveLength(1)
    expect(textOf(cards[0])).not.toContain('Qualidade')
  })

  it('a célula sem dado suficiente mostra a falta de dado, e nunca um zero', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2, { shape: TWO_DEFINITIONS })
    const ana = await newEvaluator(scene.project, 'Ana')

    for (const response of scene.responses) {
      await addEvaluation(ownerDb, scene.round, response, ana, {
        cells: filled(cellsOf(scene, 'Informacional'), 'high'),
      })
    }

    auth.userId = admin
    const text = matrixTextOf(await render(scene.project))

    expect(text).toContain('1 avaliador')
    expect(text).toContain('sem nota')
    expect(text).not.toContain('0,000')
  })

  it('a matriz é da versão de codebook que a rodada fixou, e não da vigente', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    await addCodebookVersion(ownerDb, scene.project, admin, {
      versionNumber: 2,
      definitions: [
        {
          title: 'Informacional',
          type: 'category',
          criteria: [{ name: 'Clareza' }, { name: 'Profundidade' }],
        },
      ],
    })

    auth.userId = admin
    const tree = await render(scene.project)

    expect(matrixOf(tree).codebookVersionNumber).toBe(1)

    const text = matrixTextOf(tree)
    expect(text).toContain('Clareza')
    expect(text).not.toContain('Profundidade')
    expect(text).toContain('Codebook v1')
  })

  it('a matriz e o painel continuam na tela depois que a rodada fecha', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2, {
      shape: TWO_DEFINITIONS,
      status: 'closed',
    })
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const values = ['low', 'high'] as const
    for (const [index, value] of values.entries()) {
      for (const evaluator of [ana, bruno]) {
        await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
          cells: filled(scene.cells, value),
        })
      }
    }

    auth.userId = admin
    const tree = await render(scene.project)

    expect(findElement(tree, NewRound)).toBeTruthy()
    expect(agreementTitleOf(tree)).toContain('fechada')
    expect(panelOf(tree).pair.all).toMatchObject({ calculable: true, alpha: 1 })
    expect(matrixTextOf(tree)).toContain('1,000')
  })

  it('o critério geral rende uma célula por definição, cada uma com o seu valor', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 3, { shape: TWO_DEFINITIONS })
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const agree = ['low', 'medium', 'high'] as const
    const disagree = ['high', 'medium', 'low'] as const
    for (const [index, response] of scene.responses.entries()) {
      await addEvaluation(ownerDb, scene.round, response, ana, {
        cells: filled(scene.cells, agree[index]),
      })
      await addEvaluation(ownerDb, scene.round, response, bruno, {
        cells: [
          ...filled(cellsOf(scene, 'Informacional'), agree[index]),
          ...filled(cellsOf(scene, 'Transacional'), disagree[index]),
        ],
      })
    }

    auth.userId = admin
    const text = matrixTextOf(await render(scene.project))

    expect(text.split('Clareza')).toHaveLength(2)
    expect(text).toContain('Informacional')
    expect(text).toContain('Transacional')
    expect(text).toContain('1,000')
    expect(text).toContain('-0,667')
  })

  it('o critério específico de uma definição é traço na linha da outra', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1, {
      shape: {
        definitions: [
          {
            title: 'Informacional',
            type: 'category',
            criteria: [{ name: 'Profundidade' }],
          },
          { title: 'Transacional', type: 'category' },
        ],
        generalCriteria: [{ name: 'Clareza' }],
      },
    })

    auth.userId = admin
    const matrix = createElement(AgreementMatrixTable, matrixOf(await render(scene.project)))

    expect(renderToStaticMarkup(matrix)).toContain(`title="${CELL_NOT_APPLICABLE_TITLE}"`)
    expect(markupTextOf(matrix)).toContain(CELL_NOT_APPLICABLE)
    expect(markupTextOf(matrix)).toContain('Profundidade')
  })

  it('a lista do avaliador traz só as rodadas fechadas em que ele avaliou, em ordem', async () => {
    const admin = await newUser('Admin')
    const anaUser = await newUser('Ana')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const ana = await addActiveEvaluator(ownerDb, project, anaUser)
    const bruno = await newEvaluator(project, 'Bruno')
    const item = await addInputItem(ownerDb, project, admin, { name: 'Item 1' })

    const made: string[] = []
    const responses: string[] = []
    for (const [roundNumber, status] of [
      [1, 'closed'],
      [2, 'closed'],
      [3, 'closed'],
      [4, 'open'],
    ] as const) {
      const round = await addRound(
        ownerDb,
        project,
        admin,
        codebookVersion,
        promptVersion,
        { roundNumber, status },
      )
      made.push(round)
      responses.push(await addResponse(ownerDb, round, item, admin))
    }

    for (const index of [0, 2, 3]) {
      await addEvaluation(ownerDb, made[index], responses[index], ana)
    }
    await addEvaluation(ownerDb, made[1], responses[1], bruno)

    auth.userId = anaUser
    const tree = await render(project)

    const props = evaluatorRoundsOf(tree)
    expect(props.rounds.map((round) => round.roundNumber)).toEqual([1, 3])
    expect(props.projectId).toBe(project)

    const text = markupTextOf(createElement(EvaluatorRounds, props))
    expect(text).toContain('Rodada 1')
    expect(text).toContain('Rodada 3')
    expect(text).not.toContain('Rodada 2')
    expect(text).not.toContain('Rodada 4')
    expect(text).toContain(`Fechada em ${formatDate(props.rounds[0].closedAt)}`)
  })

  it('o avaliador que ainda não avaliou nada vê o aviso, e nenhum link', async () => {
    const admin = await newUser('Admin')
    const anaUser = await newUser('Ana')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, anaUser)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
      status: 'closed',
    })

    auth.userId = anaUser
    const props = evaluatorRoundsOf(await render(project))
    expect(props.rounds).toEqual([])

    const rendered = renderToStaticMarkup(createElement(EvaluatorRounds, props))
    expect(rendered).not.toContain('href')
    expect(markupTextOf(createElement(EvaluatorRounds, props))).toContain(
      'Nenhuma rodada para revisar ainda',
    )
  })

  it('a área de rodadas do avaliador não traz nada da gestão de rodada', async () => {
    const admin = await newUser('Admin')
    const anaUser = await newUser('Ana')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, anaUser)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
    })

    auth.userId = anaUser
    const tree = await render(project)

    for (const component of [NewRound, CloseRound, GenerateResponses, RoundList]) {
      expect(findElement(tree, component)).toBeNull()
    }
    expect(evaluatorRoundsOf(tree).rounds).toEqual([])
  })

  it('a área de rodadas do avaliador não traz a fase da rodada nem o que foi à LLM', async () => {
    const admin = await newUser('Admin')
    const anaUser = await newUser('Ana')
    const scene = await roundWith(admin, 1, { status: 'closed' })
    const ana = await addActiveEvaluator(ownerDb, scene.project, anaUser)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana, {
      cells: filled(scene.cells, 'high'),
    })

    auth.userId = anaUser
    const tree = await render(scene.project)
    const props = evaluatorRoundsOf(tree)
    const text = `${allTextOf(tree)} ${markupTextOf(createElement(EvaluatorRounds, props))}`

    expect(props.rounds.map((round) => round.roundNumber)).toEqual([1])
    expect(props.rounds[0]).not.toHaveProperty('phase')
    expect(text).not.toContain('Fase')
    expect(text).not.toContain('LLM')
  })

  it('a área de rodadas do avaliador não fala de coeficiente nem de Qualidade', async () => {
    const admin = await newUser('Admin')
    const anaUser = await newUser('Ana')
    const scene = await roundWith(admin, 2, { status: 'closed', phase: PHASE_3 })
    const ana = await addActiveEvaluator(ownerDb, scene.project, anaUser)
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const values = ['low', 'high'] as const
    for (const [index, value] of values.entries()) {
      for (const evaluator of [ana, bruno]) {
        await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
          cells: filled(scene.cells, value),
        })
      }
    }

    auth.userId = anaUser
    const tree = await render(scene.project)
    const props = evaluatorRoundsOf(tree)
    const text = `${allTextOf(tree)} ${markupTextOf(createElement(EvaluatorRounds, props))}`

    expect(props.rounds.map((round) => round.roundNumber)).toEqual([1])
    for (const word of ['Krippendorff', 'ICR', 'Alpha', 'Concordância', 'Qualidade', '%']) {
      expect(text).not.toContain(word)
    }
    expect(findElement(tree, AgreementPanel)).toBeNull()
    expect(findElement(tree, QualityPanel)).toBeNull()
    expect(findElement(tree, AgreementMatrixTable)).toBeNull()
    expect(findElement(tree, QualityMatrixTable)).toBeNull()
  })

  it('o membro em onboarding é mandado concluir o onboarding', async () => {
    const admin = await newUser('Admin')
    const invited = await newUser('Convidado')
    const { project } = await readyProject(admin)
    await addPendingMember(ownerDb, project, invited)

    auth.userId = invited
    await expect(render(project)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${project}/onboarding`,
    )
  })

  it('quem não é membro não alcança a área de rodadas', async () => {
    const admin = await newUser('Admin')
    const stranger = await newUser('Estranho')
    const { project } = await readyProject(admin)

    auth.userId = stranger
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })
})
