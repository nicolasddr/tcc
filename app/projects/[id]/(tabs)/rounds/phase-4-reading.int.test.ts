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
import { AgreementPanel } from '@/app/projects/[id]/(tabs)/rounds/agreement-panel'
import { QualityPanel } from '@/app/projects/[id]/(tabs)/rounds/quality-panel'
import { formatShare } from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import type { Quality } from '@/app/projects/[id]/(tabs)/rounds/quality'
import { scaleLabel } from '@/app/projects/[id]/(tabs)/evaluate/scale'
import {
  ReferenceComparisonPanel,
  ReferenceRoundLine,
} from '@/app/projects/[id]/(tabs)/rounds/reference-comparison-panel'
import {
  COMPARISON_AGREEMENT_ROW,
  COMPARISON_EMPTY,
  COMPARISON_TOTAL_ROW,
  REFERENCE_COMPARISON_HELP,
  REFERENCE_COMPARISON_TITLE,
  noReferenceMessage,
  referenceComparisonHint,
  referenceLine,
} from '@/app/projects/[id]/(tabs)/rounds/reference-comparison-labels'
import {
  AGREEMENT_BANDS,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  formatAlpha,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { ReadingGuidanceNote } from '@/app/projects/[id]/(tabs)/rounds/reading-guidance-note'
import {
  BELOW_BAND_GUIDANCE,
  CODEBOOK_SHORTCUT,
  GUIDANCE_HEADING,
  PHASE_4_BELOW_BAND_GUIDANCE,
  PHASE_4_WITHIN_BAND_GUIDANCE,
  WITHIN_BAND_GUIDANCE,
  notCalculableGuidance,
  phase4NotCalculableGuidance,
} from '@/app/projects/[id]/(tabs)/rounds/reading-guidance-labels'
import { RoundChangeChips } from '@/app/projects/[id]/(tabs)/rounds/round-changes-note'
import { entersPhase4Note } from '@/app/projects/[id]/(tabs)/rounds/round-changes-labels'
import { PARTICIPATION_HELP } from '@/app/projects/[id]/(tabs)/rounds/participation-labels'
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
type PanelProps = Parameters<typeof AgreementPanel>[0]
type ComparisonProps = Parameters<typeof ReferenceComparisonPanel>[0]
type LineProps = Parameters<typeof ReferenceRoundLine>[0]
type GuidanceProps = Parameters<typeof ReadingGuidanceNote>[0]
type ChangesProps = Parameters<typeof RoundChangeChips>[0]
type CodebookShape = Parameters<typeof addCodebookVersion>[3]

function render(id: string) {
  return ProjectRoundsPage({ params: Promise.resolve({ id }) })
}

function listOf(tree: unknown): ListProps {
  const element = findElement(tree, RoundList)
  expect(element).toBeTruthy()
  return element!.props as ListProps
}

function panelOf(tree: unknown): PanelProps {
  const element = findElement(tree, AgreementPanel)
  expect(element).toBeTruthy()
  return element!.props as PanelProps
}

function comparisonOf(tree: unknown): ComparisonProps {
  const element = findElement(tree, ReferenceComparisonPanel)
  expect(element).toBeTruthy()
  return element!.props as ComparisonProps
}

function guidanceOf(tree: unknown): GuidanceProps | null {
  const element = findElement(tree, ReadingGuidanceNote)
  return element ? (element.props as GuidanceProps) : null
}

function guidanceTextOf(tree: unknown): string {
  const props = guidanceOf(tree)
  expect(props).toBeTruthy()
  return markupTextOf(createElement(ReadingGuidanceNote, props!))
}

function comparisonElementOf(tree: unknown): ReactElement {
  return createElement(ReferenceComparisonPanel, comparisonOf(tree))
}

function cardsOf(list: ListProps): ReactElement[] {
  return findAll(RoundList(list), 'li')
}

function referenceLineOf(card: ReactElement): ReactElement | null {
  return findElement(card, ReferenceRoundLine)
}

function changesOf(card: ReactElement): ChangesProps | null {
  const element = findElement(card, RoundChangeChips)
  return element ? (element.props as ChangesProps) : null
}

function changesTextOf(card: ReactElement): string {
  const props = changesOf(card)
  expect(props).toBeTruthy()
  return markupTextOf(createElement(RoundChangeChips, props!))
}

function tableOf(tree: unknown): string[][] {
  const markup = renderToStaticMarkup(comparisonElementOf(tree))
  return [...markup.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((cell) =>
      cell[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    ),
  )
}

function rowOf(tree: unknown, label: string): string[] | undefined {
  return tableOf(tree).find((row) => row[0] === label)
}

function withoutOutliersRows(tree: unknown): string[][] {
  return tableOf(tree).filter((row) => row[0].endsWith(AGREEMENT_WITHOUT_OUTLIERS_LABEL))
}

function levelCells(quality: Quality | null | undefined): string[] {
  if (!quality?.rated) return []
  return quality.levels.map((level) => `${formatShare(level.share)} (${level.count})`)
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

const RETURN_AND_VERDICT_WORDS = [
  'voltar',
  'volte',
  'retorn',
  'fase 3',
  'refin',
  'aprova',
  'reprova',
  'replic',
  'generaliz',
  'confirmad',
]

const PHASE_3_GUIDANCE_TEXTS = [
  BELOW_BAND_GUIDANCE,
  WITHIN_BAND_GUIDANCE,
  notCalculableGuidance('few_evaluators'),
  notCalculableGuidance('no_shared_units'),
  notCalculableGuidance('no_variation'),
]

const PHASE_4_GUIDANCE_TEXTS = [
  PHASE_4_BELOW_BAND_GUIDANCE,
  PHASE_4_WITHIN_BAND_GUIDANCE,
  phase4NotCalculableGuidance('few_evaluators'),
  phase4NotCalculableGuidance('no_shared_units'),
  phase4NotCalculableGuidance('no_variation'),
]

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

type EvaluatorName = 'ana' | 'bruno' | 'carla'

type RoundSpec = {
  roundNumber: number
  phase: number
  status: 'open' | 'closed'
  absent?: readonly EvaluatorName[]
}

type Scene = {
  project: string
  rounds: Map<number, string>
  responses: Map<number, string[]>
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
    const responses = new Map<number, string[]>()
    const members = { ana, bruno, carla }
    for (const spec of specs) {
      const round = await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
        roundNumber: spec.roundNumber,
        status: spec.status,
        phase: spec.phase,
        closedAt: spec.status === 'closed' ? closedAtOf(spec.roundNumber) : null,
      })
      rounds.set(spec.roundNumber, round)
      responses.set(spec.roundNumber, [])

      for (let index = 0; index < 3; index += 1) {
        const item = await addInputItem(ownerDb, project, admin, {
          name: `Item ${spec.roundNumber}.${index + 1}`,
        })
        const response = await addResponse(ownerDb, round, item, admin)
        responses.get(spec.roundNumber)!.push(response)
        for (const name of ['ana', 'bruno', 'carla'] as const) {
          if (spec.absent?.includes(name)) continue
          await addEvaluation(ownerDb, round, response, members[name], {
            cells: filled(NOTES[name][index]),
          })
        }
      }
    }

    return { project, rounds, responses, ana, anaUser, bruno, carla }
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

  it('o bloco aparece logo abaixo da orientação e nomeia a rodada de referência, a data e as versões', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const guidance = blockIndexOf(tree, ReadingGuidanceNote)
    const agreement = blockIndexOf(tree, AgreementPanel)
    const quality = blockIndexOf(tree, QualityPanel)
    const comparison = blockIndexOf(tree, ReferenceComparisonPanel)
    const list = blockIndexOf(tree, RoundList)
    expect(guidance).toBeGreaterThanOrEqual(0)
    expect(comparison).toBe(guidance + 1)
    expect(agreement).toBe(comparison + 1)
    expect(quality).toBe(agreement + 1)
    expect(list).toBe(quality + 1)

    const section = findSection(tree, ReferenceComparisonPanel)
    expect(section).toBeTruthy()
    const props = section!.props as { title: ReactNode; hint?: ReactNode; help?: string }
    expect(props.title).toBe(REFERENCE_COMPARISON_TITLE)
    expect(props.hint).toBe(referenceComparisonHint(2, 1))
    expect(props.help).toBe(REFERENCE_COMPARISON_HELP)

    const text = markupTextOf(comparisonElementOf(tree))
    expect(text).not.toContain('Rodada de referência:')
    expect(text.split('Codebook v3 · Prompt v2 nas duas')).toHaveLength(2)

    const [heading] = tableOf(tree)
    expect(heading).toEqual([
      '',
      'Rodada 1 Fase 3 · referência fechada em 15/01/2026',
      'Rodada 2 Fase 4 fechada em 15/02/2026',
    ])
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

    const [heading] = tableOf(tree)
    expect(heading[2]).toBe('Rodada 2 aberta Fase 4')
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

    const referenceAll = list.agreement.get(reference)!.all
    const roundAll = list.agreement.get(round)!.all
    expect(rowOf(tree, COMPARISON_AGREEMENT_ROW)).toEqual([
      COMPARISON_AGREEMENT_ROW,
      referenceAll.calculable ? formatAlpha(referenceAll.alpha) : null,
      roundAll.calculable ? formatAlpha(roundAll.alpha) : null,
    ])

    const referenceLevels = levelCells(list.quality.get(reference)?.all)
    const roundLevels = levelCells(list.quality.get(round)?.all)
    expect(referenceLevels).toHaveLength(3)
    expect(roundLevels).toHaveLength(3)
    for (const [index, value] of (['high', 'medium', 'low'] as const).entries()) {
      expect(rowOf(tree, scaleLabel(value))).toEqual([
        scaleLabel(value),
        referenceLevels[index],
        roundLevels[index],
      ])
    }
  })

  it('com outlier só na referência, só o lado dela traz os dois valores', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)
    await addOutlier(ownerDb, scene.rounds.get(1)!, scene.carla, admin)

    auth.userId = admin
    const rows = withoutOutliersRows(await render(scene.project))

    expect(rows.map((row) => row[0])).toEqual([
      `${COMPARISON_AGREEMENT_ROW} ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`,
      `${scaleLabel('high')} ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`,
      `${scaleLabel('medium')} ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`,
      `${scaleLabel('low')} ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`,
      `${COMPARISON_TOTAL_ROW} ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`,
    ])
    for (const row of rows) {
      expect(row[1]).not.toBe(COMPARISON_EMPTY)
      expect(row[2]).toBe(COMPARISON_EMPTY)
    }
  })

  it('com outlier só na rodada da Fase 4, só o lado dela traz os dois valores', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)
    await addOutlier(ownerDb, scene.rounds.get(2)!, scene.carla, admin)

    auth.userId = admin
    const rows = withoutOutliersRows(await render(scene.project))

    expect(rows).toHaveLength(5)
    for (const row of rows) {
      expect(row[1]).toBe(COMPARISON_EMPTY)
      expect(row[2]).not.toBe(COMPARISON_EMPTY)
    }
  })

  it('com outlier nas duas rodadas, os dois lados trazem os dois valores', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)
    await addOutlier(ownerDb, scene.rounds.get(1)!, scene.carla, admin)
    await addOutlier(ownerDb, scene.rounds.get(2)!, scene.bruno, admin)

    auth.userId = admin
    const rows = withoutOutliersRows(await render(scene.project))

    expect(rows).toHaveLength(5)
    for (const row of rows) {
      expect(row[1]).not.toBe(COMPARISON_EMPTY)
      expect(row[2]).not.toBe(COMPARISON_EMPTY)
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

    expect(lines[0]).toBeNull()
    expect(lines[1]).toMatch(/^Referência: rodada 1 · ICR /)
    expect(lines[2]).toBeNull()
    expect(lines[3]).toMatch(/^Referência: rodada 3 · ICR /)
    expect(lines[1]).not.toContain('Codebook')
    expect(lines[1]).not.toContain('Prompt')

    const { reference } = referenceLineOf(cards[1])!.props as LineProps
    expect(reference.agreement).toBe(list.agreement.get(scene.rounds.get(1)!))
    expect(reference.quality).toBe(list.quality.get(scene.rounds.get(1)!))
    expect(lines[1]).toBe(referenceLine(reference))
  })

  it('no cartão da rodada da Fase 4, a frase nomeia a mesma rodada de referência do bloco de comparação', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const { comparison } = comparisonOf(tree)
    expect(comparison.kind).toBe('compared')
    const reference = comparison.kind === 'compared' ? comparison.reference.roundNumber : null
    expect(reference).toBe(1)

    const cards = cardsOf(listOf(tree))
    const changes = changesOf(cards[1])
    expect(changes).toBeTruthy()
    expect(changes!.changes?.entersPhase4).toBe(true)
    expect(changesTextOf(cards[1])).toContain(entersPhase4Note(reference!))
  })

  it('depois de um retorno e de um novo avanço, a frase nomeia a referência da passagem', async () => {
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

    const cards = cardsOf(listOf(tree))
    expect(changesTextOf(cards[1])).toContain(entersPhase4Note(1))
    expect(changesOf(cards[2])!.changes?.entersPhase4).toBe(false)
    expect(changesTextOf(cards[2])).not.toMatch(/Primeira rodada da Fase 4/)
    expect(changesTextOf(cards[3])).toContain(entersPhase4Note(3))
    expect(changesTextOf(cards[3])).not.toContain(entersPhase4Note(1))
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

  it('numa rodada da Fase 4 abaixo da faixa, a orientação é a da Fase 4', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const all = panelOf(tree).pair.all
    expect(all.calculable).toBe(true)
    expect(all.calculable && all.alpha).toBeLessThan(AGREEMENT_BANDS.acceptable)

    expect(guidanceOf(tree)).toEqual({
      guidance: { phase: PHASE_4, kind: 'below_band' },
      projectId: scene.project,
    })
    expect(guidanceTextOf(tree)).toBe(`${GUIDANCE_HEADING} ${PHASE_4_BELOW_BAND_GUIDANCE}`)
  })

  it('numa rodada da Fase 4 dentro da faixa, a orientação manda olhar a Qualidade ao lado da referência', async () => {
    const admin = await newUser('Admin')
    const scene = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_3, status: 'closed' },
      { roundNumber: 2, phase: PHASE_4, status: 'closed', absent: ['carla'] },
    ])

    auth.userId = admin
    const tree = await render(scene.project)

    expect(panelOf(tree).pair.all).toMatchObject({ calculable: true, alpha: 1 })

    expect(guidanceOf(tree)).toEqual({
      guidance: { phase: PHASE_4, kind: 'within_band' },
      projectId: scene.project,
    })
    expect(guidanceTextOf(tree)).toBe(`${GUIDANCE_HEADING} ${PHASE_4_WITHIN_BAND_GUIDANCE}`)
  })

  it('numa rodada da Fase 4 com um avaliador só, a orientação diz por que não há ICR e que a comparação ainda não é possível', async () => {
    const admin = await newUser('Admin')
    const scene = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_3, status: 'closed' },
      { roundNumber: 2, phase: PHASE_4, status: 'closed', absent: ['bruno', 'carla'] },
    ])

    auth.userId = admin
    const tree = await render(scene.project)

    expect(panelOf(tree).pair.all).toMatchObject({
      calculable: false,
      reason: 'few_evaluators',
    })
    expect(guidanceOf(tree)).toEqual({
      guidance: { phase: PHASE_4, kind: 'not_calculable', reason: 'few_evaluators' },
      projectId: scene.project,
    })
    expect(guidanceTextOf(tree)).toBe(
      `${GUIDANCE_HEADING} ${phase4NotCalculableGuidance('few_evaluators')}`,
    )
  })

  it('nenhum texto renderizado da orientação da Fase 4 fala em voltar, refinar ou veredito, e ela não tem atalho', async () => {
    const admin = await newUser('Admin')
    const absences: (readonly EvaluatorName[])[] = [[], ['carla'], ['bruno', 'carla']]

    auth.userId = admin
    const kinds: string[] = []
    for (const absent of absences) {
      const scene = await phase4Scene(admin, [
        { roundNumber: 1, phase: PHASE_3, status: 'closed' },
        { roundNumber: 2, phase: PHASE_4, status: 'closed', absent },
      ])
      const tree = await render(scene.project)
      kinds.push(guidanceOf(tree)!.guidance.kind)

      const markup = renderToStaticMarkup(
        createElement(ReadingGuidanceNote, guidanceOf(tree)!),
      )
      expect(markup).not.toContain('<a ')

      const text = guidanceTextOf(tree)
      const lower = text.toLowerCase()
      for (const word of [...RETURN_AND_VERDICT_WORDS, ...JUDGMENT_WORDS]) {
        expect(lower).not.toContain(word)
      }
      for (const phase3Text of PHASE_3_GUIDANCE_TEXTS) expect(text).not.toContain(phase3Text)
    }
    expect(kinds).toEqual(['below_band', 'within_band', 'not_calculable'])
  })

  it('num projeto na Fase 4 sem rodada da Fase 4, a rodada em foco da Fase 3 mostra o texto da Fase 3', async () => {
    const admin = await newUser('Admin')
    const scene = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_3, status: 'closed' },
    ])

    auth.userId = admin
    const tree = await render(scene.project)

    expect(guidanceOf(tree)).toEqual({
      guidance: { phase: PHASE_3, kind: 'below_band' },
      projectId: scene.project,
    })
    expect(guidanceTextOf(tree)).toBe(
      `${GUIDANCE_HEADING} ${BELOW_BAND_GUIDANCE} ${CODEBOOK_SHORTCUT}`,
    )
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
    expect(findElement(tree, ReadingGuidanceNote)).toBeNull()
    for (const word of ['rodada de referência', 'concordância', 'qualidade']) {
      expect(text).not.toContain(word)
    }
    expect(text).not.toContain(GUIDANCE_HEADING.toLowerCase())
    for (const guidance of PHASE_4_GUIDANCE_TEXTS) {
      expect(text).not.toContain(guidance.toLowerCase())
    }
    expect(findElement(tree, RoundChangeChips)).toBeNull()
    expect(text).not.toContain(entersPhase4Note(1).toLowerCase())
    expect(text).not.toContain('primeira rodada da fase 4')
  })

  it('no painel da rodada da Fase 4, quem avaliou antes tem a marca e quem chegou agora não', async () => {
    const admin = await newUser('Admin')
    const scene = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_3, status: 'closed', absent: ['carla'] },
      { roundNumber: 2, phase: PHASE_4, status: 'closed' },
    ])

    auth.userId = admin
    const tree = await render(scene.project)

    expect(panelOf(tree).participation).toEqual({
      [scene.ana]: 'avaliou na rodada 1 (Fase 3)',
      [scene.bruno]: 'avaliou na rodada 1 (Fase 3)',
    })

    const text = markupTextOf(createElement(AgreementPanel, panelOf(tree)))
    expect(text).toContain('Ana avaliou na rodada 1 (Fase 3)')
    expect(text).toContain('Bruno avaliou na rodada 1 (Fase 3)')
    expect(text).not.toContain('Carla avaliou')
    expect(text).not.toContain('rodada 2')
  })

  it('com a rodada da Fase 4 aberta, as avaliações dela não entram na marca', async () => {
    const admin = await newUser('Admin')
    const scene = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_3, status: 'closed', absent: ['carla'] },
      { roundNumber: 2, phase: PHASE_4, status: 'open' },
    ])

    auth.userId = admin
    const tree = await render(scene.project)

    expect(panelOf(tree).participation).toEqual({
      [scene.ana]: 'avaliou na rodada 1 (Fase 3)',
      [scene.bruno]: 'avaliou na rodada 1 (Fase 3)',
    })
  })

  it('depois de um retorno e de um novo avanço, a marca lista todas as rodadas anteriores', async () => {
    const admin = await newUser('Admin')
    const scene = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_3, status: 'closed' },
      { roundNumber: 2, phase: PHASE_4, status: 'closed' },
      { roundNumber: 3, phase: PHASE_3, status: 'closed' },
      { roundNumber: 4, phase: PHASE_4, status: 'open' },
    ])

    auth.userId = admin
    const tree = await render(scene.project)

    expect(panelOf(tree).participation?.[scene.ana]).toBe(
      'avaliou nas rodadas 1 (Fase 3), 2 (Fase 4) e 3 (Fase 3)',
    )
  })

  it('o Administrador-avaliador aparece com a marca pelo vínculo de avaliador', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)
    const adminAsEvaluator = await addActiveEvaluator(ownerDb, scene.project, admin)
    await addEvaluation(
      ownerDb,
      scene.rounds.get(1)!,
      scene.responses.get(1)![0],
      adminAsEvaluator,
    )

    auth.userId = admin
    const tree = await render(scene.project)

    expect(panelOf(tree).participation?.[adminAsEvaluator]).toBe(
      'avaliou na rodada 1 (Fase 3)',
    )
  })

  it('com a marca no painel, o texto de ajuda explica a marca e aponta a marca de outlier', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)

    auth.userId = admin
    const tree = await render(scene.project)

    const markup = renderToStaticMarkup(createElement(AgreementPanel, panelOf(tree)))
    const tooltips = [...markup.matchAll(/aria-label="([^"]*)"/g)].map((match) =>
      match[1].replaceAll('&quot;', '"'),
    )
    expect(tooltips.some((text) => text.includes(PARTICIPATION_HELP))).toBe(true)
  })

  it('numa rodada em foco da Fase 3 ou da Fase 2, o painel não recebe marca', async () => {
    const admin = await newUser('Admin')
    const phase3 = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_3, status: 'closed' },
      { roundNumber: 2, phase: PHASE_4, status: 'closed' },
      { roundNumber: 3, phase: PHASE_3, status: 'open' },
    ])
    const phase2 = await phase4Scene(admin, [
      { roundNumber: 1, phase: PHASE_2, status: 'closed' },
      { roundNumber: 2, phase: PHASE_2, status: 'closed' },
    ])

    auth.userId = admin
    for (const scene of [phase3, phase2]) {
      const tree = await render(scene.project)
      expect(panelOf(tree).participation).toBeUndefined()
      expect(markupTextOf(createElement(AgreementPanel, panelOf(tree)))).not.toContain(
        'avaliou n',
      )
    }
  })

  it('o Avaliador não vê a marca de participação', async () => {
    const admin = await newUser('Admin')
    const scene = await basicScene(admin)

    auth.userId = scene.anaUser
    const tree = await render(scene.project)

    expect(findElement(tree, AgreementPanel)).toBeNull()
    expect(allTextOf(tree)).not.toContain('avaliou n')
  })
})
