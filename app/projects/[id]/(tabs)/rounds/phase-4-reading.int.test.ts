import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
import {
  AgreementPanel,
  AgreementValue,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-panel'
import { QualityPanel, QualityValue } from '@/app/projects/[id]/(tabs)/rounds/quality-panel'
import {
  ReferenceComparisonPanel,
  ReferenceRoundLine,
} from '@/app/projects/[id]/(tabs)/rounds/reference-comparison-panel'
import {
  REFERENCE_COMPARISON_HELP,
  REFERENCE_COMPARISON_TITLE,
  noReferenceMessage,
  referenceComparisonHint,
  referenceLine,
} from '@/app/projects/[id]/(tabs)/rounds/reference-comparison-labels'
import { AGREEMENT_WITHOUT_OUTLIERS_LABEL } from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { Section } from '@/app/components/ui/section'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import {
  PHASE_2,
  PHASE_3,
  PHASE_4,
} from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb } from '@/lib/db'
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

function findAll(node: unknown, type: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type))
  if (!isValidElement(node)) return []
  if (node.type === type) return [node]
  return Object.values(node.props as Record<string, unknown>).flatMap((value) =>
    findAll(value, type),
  )
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

function markupTextOf(element: ReactElement): string {
  return renderToStaticMarkup(element)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function classNamesOf(element: ReactElement): string[] {
  return [...renderToStaticMarkup(element).matchAll(/class="([^"]*)"/g)].map(
    (match) => match[1],
  )
}

function blockIndexOf(tree: unknown, type: unknown): number {
  const children = (tree as ReactElement<{ children: unknown[] }>).props.children
  return children
    .filter((child) => child !== null)
    .findIndex((child) => findElement(child, type) !== null)
}

type ListProps = Parameters<typeof RoundList>[0]
type ComparisonProps = Parameters<typeof ReferenceComparisonPanel>[0]
type LineProps = Parameters<typeof ReferenceRoundLine>[0]
type CodebookShape = Parameters<typeof addCodebookVersion>[3]

function render(id: string) {
  return ProjectRoundsPage({ params: Promise.resolve({ id }) })
}

function listOf(tree: unknown): ListProps {
  const element = findElement(tree, RoundList)
  expect(element).toBeTruthy()
  return element!.props as ListProps
}

function comparisonOf(tree: unknown): ComparisonProps {
  const element = findElement(tree, ReferenceComparisonPanel)
  expect(element).toBeTruthy()
  return element!.props as ComparisonProps
}

function comparisonElementOf(tree: unknown): ReactElement {
  return createElement(ReferenceComparisonPanel, comparisonOf(tree))
}

function cardsOf(list: ListProps): ReactElement[] {
  return (RoundList(list).props as { children: ReactElement[] }).children
}

function referenceLineOf(card: ReactElement): ReactElement | null {
  return findElement(card, ReferenceRoundLine)
}

function sidesOf(tree: unknown): { agreement: ReactElement; quality: ReactElement }[] {
  const rendered = ReferenceComparisonPanel(comparisonOf(tree))
  const agreement = findAll(rendered, AgreementValue)
  const quality = findAll(rendered, QualityValue)
  expect(agreement).toHaveLength(2)
  expect(quality).toHaveLength(2)
  return [0, 1].map((index) => ({ agreement: agreement[index], quality: quality[index] }))
}

const JUDGMENT_WORDS = [
  'melhor',
  'pior',
  'suficiente',
  'insuficiente',
  'subiu',
  'caiu',
  'replic',
  'generaliz',
  'aprovad',
  'reprovad',
  '↑',
  '↓',
  '▲',
  '▼',
]

const JUDGMENT_TONES = ['success', 'warning', 'danger', 'brand']

function expectNoJudgment(element: ReactElement) {
  const text = markupTextOf(element).toLowerCase()
  for (const word of JUDGMENT_WORDS) expect(text).not.toContain(word)
  expect(text).not.toMatch(/[+−]\s*\d/)

  const classes = classNamesOf(element)
  expect(classes.length).toBeGreaterThan(0)
  for (const className of classes) {
    for (const tone of JUDGMENT_TONES) expect(className).not.toContain(tone)
  }
}

type RoundSpec = {
  roundNumber: number
  phase: number
  status: 'open' | 'closed'
}

type Scene = {
  project: string
  rounds: Map<number, string>
  ana: string
  anaUser: string
  bruno: string
  carla: string
}

const SHAPE: CodebookShape = {
  versionNumber: 3,
  definitions: [
    {
      title: 'Informacional',
      type: 'category',
      criteria: [{ name: 'Clareza' }, { name: 'Profundidade' }],
    },
  ],
}

const NOTES = {
  ana: ['low', 'medium', 'high'],
  bruno: ['low', 'medium', 'high'],
  carla: ['high', 'medium', 'low'],
} as const

function closedAtOf(roundNumber: number): string {
  return `2026-0${roundNumber}-15T12:00:00.000Z`
}

describe('app/projects/[id]/rounds — a rodada da Fase 4 ao lado da rodada de referência', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function phase4Scene(admin: string, specs: RoundSpec[]): Promise<Scene> {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase: PHASE_4 })
    projs.push(project)
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, SHAPE)
    const promptVersion = await addPromptVersion(ownerDb, project, admin, { versionNumber: 2 })

    const anaUser = await newUser('Ana')
    const ana = await addActiveEvaluator(ownerDb, project, anaUser)
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const carla = await addActiveEvaluator(ownerDb, project, await newUser('Carla'))

    const codebook = await loadCodebookVersion(project, codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria)
    const filled = (value: CellFixture['value']): CellFixture[] =>
      cells.map((cell) => ({
        definitionId: cell.definition.id,
        criterionId: cell.criterion.id,
        value,
      }))

    const rounds = new Map<number, string>()
    for (const spec of specs) {
      const round = await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
        roundNumber: spec.roundNumber,
        status: spec.status,
        phase: spec.phase,
        closedAt: spec.status === 'closed' ? closedAtOf(spec.roundNumber) : null,
      })
      rounds.set(spec.roundNumber, round)

      for (let index = 0; index < 3; index += 1) {
        const item = await addInputItem(ownerDb, project, admin, {
          name: `Item ${spec.roundNumber}.${index + 1}`,
        })
        const response = await addResponse(ownerDb, round, item, admin)
        for (const [member, notes] of [
          [ana, NOTES.ana],
          [bruno, NOTES.bruno],
          [carla, NOTES.carla],
        ] as const) {
          await addEvaluation(ownerDb, round, response, member, {
            cells: filled(notes[index]),
          })
        }
      }
    }

    return { project, rounds, ana, anaUser, bruno, carla }
  }

  function basicScene(admin: string, status: 'open' | 'closed' = 'closed') {
    return phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_3, status: 'closed' },
      { roundNumber: 2, phase: PHASE_4, status },
    ])
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o bloco aparece logo abaixo da Qualidade e nomeia a rodada de referência, a data e as versões', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const agreement = blockIndexOf(tree, AgreementPanel)
    const quality = blockIndexOf(tree, QualityPanel)
    const comparison = blockIndexOf(tree, ReferenceComparisonPanel)
    const list = blockIndexOf(tree, RoundList)
    expect(agreement).toBeGreaterThanOrEqual(0)
    expect(quality).toBe(agreement + 1)
    expect(comparison).toBe(quality + 1)
    expect(list).toBe(comparison + 1)

    const section = findSection(tree, ReferenceComparisonPanel)
    expect(section).toBeTruthy()
    const props = section!.props as { title: ReactNode; hint?: ReactNode; help?: string }
    expect(props.title).toBe(REFERENCE_COMPARISON_TITLE)
    expect(props.hint).toBe(referenceComparisonHint(2, 1))
    expect(props.help).toBe(REFERENCE_COMPARISON_HELP)

    const text = markupTextOf(comparisonElementOf(tree))
    expect(text).toContain(
      'Rodada de referência: rodada 1, fechada em 15/01/2026. Ela validou o codebook na ' +
        'versão 3 e o prompt na versão 2.',
    )
    expect(text).toContain('Rodada 1 · Fase 3')
    expect(text).toContain('Rodada 2 · Fase 4')
    expect(text).toContain('fechada em 15/02/2026')
    expect(text.indexOf('Rodada 1 · Fase 3')).toBeLessThan(text.indexOf('Rodada 2 · Fase 4'))
    expect(text.split('Codebook v3 · Prompt v2')).toHaveLength(3)
  })

  it('com a rodada da Fase 4 aberta, o bloco aparece e o lado dela diz que está aberta', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin, 'open')

    auth.userId = admin
    const tree = await render(scene.project)

    const { comparison } = comparisonOf(tree)
    expect(comparison.kind).toBe('compared')
    if (comparison.kind !== 'compared') return
    expect(comparison.reference.roundNumber).toBe(1)
    expect(comparison.round.closedAt).toBeNull()

    const text = markupTextOf(comparisonElementOf(tree))
    expect(text).toContain('Rodada 2 · Fase 4 aberta')
  })

  it('os dois lados trazem ICR e Qualidade com os mesmos números da lista de rodadas', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)

    auth.userId = admin
    const tree = await render(scene.project)
    const list = listOf(tree)
    const { comparison } = comparisonOf(tree)
    expect(comparison.kind).toBe('compared')
    if (comparison.kind !== 'compared') return

    const reference = scene.rounds.get(1)!
    const round = scene.rounds.get(2)!
    expect(comparison.reference.agreement).toBe(list.agreement.get(reference))
    expect(comparison.reference.quality).toBe(list.quality.get(reference))
    expect(comparison.round.agreement).toBe(list.agreement.get(round))
    expect(comparison.round.quality).toBe(list.quality.get(round))
    expect(comparison.reference.agreement.all.calculable).toBe(true)
    expect(comparison.round.agreement.all.calculable).toBe(true)

    const [left, right] = sidesOf(tree)
    expect((left.agreement.props as { pair: unknown }).pair).toBe(list.agreement.get(reference))
    expect((right.agreement.props as { pair: unknown }).pair).toBe(list.agreement.get(round))
    expect((left.quality.props as { pair: unknown }).pair).toBe(list.quality.get(reference))
    expect((right.quality.props as { pair: unknown }).pair).toBe(list.quality.get(round))
  })

  it('com outlier só na referência, só o lado dela traz os dois valores', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)
    await addOutlier(ownerDb, scene.rounds.get(1)!, scene.carla, admin)

    auth.userId = admin
    const [left, right] = sidesOf(await render(scene.project))

    expect(markupTextOf(left.agreement)).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(markupTextOf(left.quality)).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(markupTextOf(right.agreement)).not.toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(markupTextOf(right.quality)).not.toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
  })

  it('com outlier só na rodada da Fase 4, só o lado dela traz os dois valores', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)
    await addOutlier(ownerDb, scene.rounds.get(2)!, scene.carla, admin)

    auth.userId = admin
    const [left, right] = sidesOf(await render(scene.project))

    expect(markupTextOf(left.agreement)).not.toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(markupTextOf(left.quality)).not.toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(markupTextOf(right.agreement)).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(markupTextOf(right.quality)).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
  })

  it('com outlier nas duas rodadas, os dois lados trazem os dois valores', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)
    await addOutlier(ownerDb, scene.rounds.get(1)!, scene.carla, admin)
    await addOutlier(ownerDb, scene.rounds.get(2)!, scene.bruno, admin)

    auth.userId = admin
    const sides = sidesOf(await render(scene.project))

    for (const side of sides) {
      expect(markupTextOf(side.agreement)).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
      expect(markupTextOf(side.quality)).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    }
  })

  it('depois de um retorno e de um novo avanço, cada rodada da Fase 4 nomeia a sua referência', async () => {
    const admin = await newUser('Admin')
    const scene = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_3, status: 'closed' },
      { roundNumber: 2, phase: PHASE_4, status: 'closed' },
      { roundNumber: 3, phase: PHASE_3, status: 'closed' },
      { roundNumber: 4, phase: PHASE_4, status: 'open' },
    ])

    auth.userId = admin
    const tree = await render(scene.project)

    const { comparison } = comparisonOf(tree)
    expect(comparison.kind === 'compared' && comparison.reference.roundNumber).toBe(3)

    const list = listOf(tree)
    const cards = cardsOf(list)
    const lines = cards.map((card) => {
      const line = referenceLineOf(card)
      return line ? markupTextOf(line) : null
    })

    const versions = { codebookVersionNumber: 3, promptVersionNumber: 2 }
    expect(lines[0]).toBeNull()
    expect(lines[1]).toContain(referenceLine({ roundNumber: 1, ...versions }))
    expect(lines[2]).toBeNull()
    expect(lines[3]).toContain(referenceLine({ roundNumber: 3, ...versions }))

    const secondLine = referenceLineOf(cards[1])!
    const pairs = findAll(
      ReferenceRoundLine(secondLine.props as LineProps),
      AgreementValue,
    )
    expect(pairs).toHaveLength(1)
    expect((pairs[0].props as { pair: unknown }).pair).toBe(
      list.agreement.get(scene.rounds.get(1)!),
    )
  })

  it('numa rodada em foco da Fase 3, o bloco não aparece, e nenhum cartão das Fases 2 e 3 traz a referência', async () => {
    const admin = await newUser('Admin')
    const scene = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_2, status: 'closed' },
      { roundNumber: 2, phase: PHASE_3, status: 'closed' },
      { roundNumber: 3, phase: PHASE_4, status: 'closed' },
      { roundNumber: 4, phase: PHASE_3, status: 'closed' },
    ])

    auth.userId = admin
    const tree = await render(scene.project)

    expect(findElement(tree, ReferenceComparisonPanel)).toBeNull()
    expect(allTextOf(tree)).not.toContain(REFERENCE_COMPARISON_TITLE)

    const cards = cardsOf(listOf(tree))
    expect(referenceLineOf(cards[0])).toBeNull()
    expect(referenceLineOf(cards[1])).toBeNull()
    expect(referenceLineOf(cards[2])).not.toBeNull()
    expect(referenceLineOf(cards[3])).toBeNull()
  })

  it('numa rodada da Fase 4 sem rodada de referência, o bloco diz que não há com o que comparar', async () => {
    const admin = await newUser('Admin')
    const scene = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_4, status: 'closed' },
    ])

    auth.userId = admin
    const tree = await render(scene.project)

    const props = comparisonOf(tree)
    expect(props.comparison).toEqual({ kind: 'no_reference' })
    expect(markupTextOf(comparisonElementOf(tree))).toBe(noReferenceMessage(1))

    const section = findSection(tree, ReferenceComparisonPanel)
    expect((section!.props as { title: ReactNode }).title).toBe(REFERENCE_COMPARISON_TITLE)

    const cards = cardsOf(listOf(tree))
    expect(referenceLineOf(cards[0])).toBeNull()
  })

  it('o bloco e a linha da referência não usam palavra, seta, diferença nem cor de juízo', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)
    await addOutlier(ownerDb, scene.rounds.get(1)!, scene.carla, admin)
    await addOutlier(ownerDb, scene.rounds.get(2)!, scene.carla, admin)

    auth.userId = admin
    const tree = await render(scene.project)

    expectNoJudgment(comparisonElementOf(tree))

    const line = referenceLineOf(cardsOf(listOf(tree))[1])
    expect(line).toBeTruthy()
    expectNoJudgment(line!)
  })

  it('o Avaliador não vê comparação, rodada de referência, Concordância nem Qualidade', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)

    auth.userId = scene.anaUser
    const tree = await render(scene.project)
    const text = allTextOf(tree).toLowerCase()

    expect(findElement(tree, ReferenceComparisonPanel)).toBeNull()
    expect(findElement(tree, ReferenceRoundLine)).toBeNull()
    expect(findElement(tree, RoundList)).toBeNull()
    for (const word of ['rodada de referência', 'concordância', 'qualidade']) {
      expect(text).not.toContain(word)
    }
  })
})
