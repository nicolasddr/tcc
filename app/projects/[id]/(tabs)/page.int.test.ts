// app/projects/[id]/(tabs)/page.int.test.ts — teste de integração do ESCOPO de visibilidade
// da página do projeto (issue #22). "Quem não participa não enxerga o projeto": prova a
// checagem EXPLÍCITA (`canView` → notFound) que a página faz na app-layer.
//
// A página é um Server Component: renderizá-la aqui só monta a árvore de elementos
// (nenhum componente-cliente executa). Cada acesso commita via `transaction`, então as
// fixtures são gravadas por `ownerDb` e limpas por `cleanup()`.
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { Fragment, createElement, isValidElement, type ReactElement } from 'react'
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
  usePathname: () => '/',
}))

import ProjectPage from '@/app/projects/[id]/(tabs)/page'
import ProjectRoundsPage from '@/app/projects/[id]/(tabs)/rounds/page'
import ProjectTabsLayout from '@/app/projects/[id]/(tabs)/layout'
import { ProjectTabs } from '@/app/projects/[id]/project-tabs'
import { PipelineChecklist } from '@/app/projects/[id]/pipeline/pipeline-checklist'
import { Phase2Checklist } from '@/app/projects/[id]/pipeline/phase-2-checklist'
import { Phase3Checklist } from '@/app/projects/[id]/pipeline/phase-3-checklist'
import { QUALITY_REFERENCE } from '@/app/projects/[id]/pipeline/last-round-summary'
import { AdvancePhase } from '@/app/projects/[id]/pipeline/advance-phase'
import { Phase4Return } from '@/app/projects/[id]/pipeline/phase-4-return'
import { Disclosure } from '@/app/components/ui/disclosure'
import { Badge } from '@/app/components/ui/badge'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { PhaseBar } from '@/app/projects/[id]/phase-bar'
import { FROZEN_BADGE_HELP, FROZEN_BADGE_LABEL } from '@/app/projects/[id]/pipeline/freeze'
import { StatCard } from '@/app/components/ui/stat'
import {
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
  pendingRequirements,
  phase2BlockerMessage,
  phase3BlockerMessage,
  phase4ConfirmationLines,
} from '@/app/projects/[id]/pipeline/preconditions'
import { AgreementSeriesChart } from '@/app/projects/[id]/(tabs)/rounds/agreement-series-chart'
import { HowToRead } from '@/app/projects/[id]/(tabs)/rounds/how-to-read'
import { QualityPanel } from '@/app/projects/[id]/(tabs)/rounds/quality-panel'
import { QualitySeriesList } from '@/app/projects/[id]/(tabs)/rounds/quality-series-list'
import {
  QUALITY_SERIES_HELP,
  QUALITY_SERIES_HINT,
  QUALITY_SERIES_NOTE,
  QUALITY_SERIES_NUMBERS,
} from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import { phaseRuns } from '@/app/projects/[id]/(tabs)/rounds/agreement-series'
import { QualityMatrixTable } from '@/app/projects/[id]/(tabs)/rounds/quality-matrix-table'
import { Section } from '@/app/components/ui/section'
import { OpenLink } from '@/app/components/ui/open-link'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_BANDS,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  BAND_REFERENCE,
  NOT_CALCULABLE_LABEL,
  agreementBand,
  bandLabel,
  formatAlpha,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { ownerDb, projects, rounds } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  addPendingInvitation,
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

function deepText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return ` ${node} `
  if (Array.isArray(node)) return node.map(deepText).join('')
  if (isValidElement(node)) {
    return Object.values(node.props as Record<string, unknown>)
      .map(deepText)
      .join('')
  }
  return ''
}

function hasProp(node: unknown, key: string, value: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => hasProp(child, key, value))
  if (!isValidElement(node)) return false
  const props = node.props as Record<string, unknown>
  if (props[key] === value) return true
  return Object.values(props).some((child) => hasProp(child, key, value))
}

function elementWithProp(node: unknown, key: string, value: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = elementWithProp(child, key, value)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const props = node.props as Record<string, unknown>
  if (props[key] === value) return node
  for (const child of Object.values(props)) {
    const found = elementWithProp(child, key, value)
    if (found) return found
  }
  return null
}

function roundsLinksOf(node: unknown, project: string): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => roundsLinksOf(child, project))
  if (!isValidElement(node)) return []
  const props = node.props as Record<string, unknown>
  const own =
    node.type === OpenLink && props.href === `/projects/${project}/rounds` ? [node] : []
  return [
    ...own,
    ...Object.values(props).flatMap((child) => roundsLinksOf(child, project)),
  ]
}

function typesOf(children: unknown): unknown[] {
  return [children]
    .flat(Infinity)
    .filter(isValidElement)
    .flatMap((child) =>
      child.type === Fragment
        ? typesOf((child.props as { children: unknown }).children)
        : [child.type],
    )
}

function gridOf(tree: unknown): ReactElement {
  const card = findElement(tree, StatCard)
  expect(card).toBeTruthy()
  const parent = parentOf(tree, card!)
  expect(parent).toBeTruthy()
  return parent!
}

function parentOf(node: unknown, target: ReactElement): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = parentOf(child, target)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const children = (node.props as { children?: unknown }).children
  if ([children].flat(Infinity).includes(target)) return node
  for (const value of Object.values(node.props as Record<string, unknown>)) {
    const found = parentOf(value, target)
    if (found) return found
  }
  return null
}

type ChecklistProps = Parameters<typeof PipelineChecklist>[0]
type Phase2Props = Parameters<typeof Phase2Checklist>[0]
type Phase3Props = Parameters<typeof Phase3Checklist>[0]
type TabsProps = Parameters<typeof ProjectTabs>[0]
type AdvanceProps = Parameters<typeof AdvancePhase>[0]
type SeriesProps = Parameters<typeof AgreementSeriesChart>[0]
type QualityProps = Parameters<typeof QualityPanel>[0]
type QualitySeriesProps = Parameters<typeof QualitySeriesList>[0]

type ScaleValue = NonNullable<CellFixture['value']>

function render(id: string) {
  return ProjectPage({ params: Promise.resolve({ id }) })
}

function renderRounds(id: string) {
  return ProjectRoundsPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  })
}

function renderLayout(id: string) {
  return ProjectTabsLayout({ params: Promise.resolve({ id }), children: null })
}

function checklistOf(tree: unknown): ChecklistProps | null {
  const element = findElement(tree, PipelineChecklist)
  return element ? (element.props as ChecklistProps) : null
}

function advanceOf(tree: unknown): ReactElement | null {
  const props = checklistOf(tree)
  if (!props) return null
  return findElement(PipelineChecklist(props), AdvancePhase)
}

function phase2Of(tree: unknown): Phase2Props | null {
  const element = findElement(tree, Phase2Checklist)
  return element ? (element.props as Phase2Props) : null
}

function phase2AdvanceOf(tree: unknown): AdvanceProps | null {
  const props = phase2Of(tree)
  if (!props) return null
  const element = findElement(Phase2Checklist(props), AdvancePhase)
  return element ? (element.props as AdvanceProps) : null
}

function phase2TextOf(tree: unknown): string {
  const props = phase2Of(tree)
  expect(props).toBeTruthy()
  return renderToStaticMarkup(createElement(Phase2Checklist, props!))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function phase3Of(tree: unknown): Phase3Props | null {
  const element = findElement(tree, Phase3Checklist)
  return element ? (element.props as Phase3Props) : null
}

function phase3AdvanceOf(tree: unknown): AdvanceProps | null {
  const props = phase3Of(tree)
  if (!props) return null
  const element = findElement(Phase3Checklist(props), AdvancePhase)
  return element ? (element.props as AdvanceProps) : null
}

function phase3TextOf(tree: unknown): string {
  const props = phase3Of(tree)
  expect(props).toBeTruthy()
  return renderToStaticMarkup(createElement(Phase3Checklist, props!))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function seriesOf(tree: unknown): SeriesProps {
  const element = findElement(tree, AgreementSeriesChart)
  expect(element).toBeTruthy()
  return element!.props as SeriesProps
}

function seriesMarkupOf(tree: unknown): string {
  return renderToStaticMarkup(createElement(AgreementSeriesChart, seriesOf(tree)))
}

function seriesTextOf(tree: unknown): string {
  return seriesMarkupOf(tree)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function qualityOf(tree: unknown): QualityProps {
  const element = findElement(tree, QualityPanel)
  expect(element).toBeTruthy()
  return element!.props as QualityProps
}

function qualityTextOf(tree: unknown): string {
  return renderToStaticMarkup(createElement(QualityPanel, qualityOf(tree)))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function qualitySeriesOf(tree: unknown): QualitySeriesProps {
  const element = findElement(tree, QualitySeriesList)
  expect(element).toBeTruthy()
  return element!.props as QualitySeriesProps
}

function qualitySeriesMarkupOf(tree: unknown): string {
  return renderToStaticMarkup(createElement(QualitySeriesList, qualitySeriesOf(tree)))
}

function textOfMarkup(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function qualitySeriesTextOf(tree: unknown): string {
  return textOfMarkup(qualitySeriesMarkupOf(tree))
}

function qualitySeriesPartsOf(tree: unknown): { bars: string; numbers: string } {
  const markup = qualitySeriesMarkupOf(tree)
  const split = markup.indexOf('<details')
  expect(split).toBeGreaterThan(0)
  return { bars: markup.slice(0, split), numbers: markup.slice(split) }
}

function sectionWith(node: unknown, type: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = sectionWith(child, type)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  if (node.type === Section && findElement(node, type)) return node
  for (const value of Object.values(node.props as Record<string, unknown>)) {
    const found = sectionWith(value, type)
    if (found) return found
  }
  return null
}

describe('app/projects/[id]/page — escopo de visibilidade', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string, phase?: number): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
    projs.push(id)
    return id
  }

  async function tabsOf(projectId: string, userId: string) {
    auth.userId = userId
    const tabs = findElement(await renderLayout(projectId), ProjectTabs)
    expect(tabs).toBeTruthy()
    return ProjectTabs(tabs!.props as TabsProps)
  }

  async function roundWith(
    project: string,
    admin: string,
    promptVersion: string,
    opts: {
      roundNumber: number
      versionNumber: number
      status?: 'open' | 'closed'
      phase?: number
      byEvaluator?: Record<string, readonly ScaleValue[]>
    },
  ): Promise<string> {
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: opts.versionNumber,
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
      ],
    })
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: opts.roundNumber, status: opts.status ?? 'closed', phase: opts.phase },
    )

    const codebook = await loadCodebookVersion(project, codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria)
    const byEvaluator = Object.entries(opts.byEvaluator ?? {})
    const responseCount = byEvaluator[0]?.[1].length ?? 0

    const responses: string[] = []
    for (let index = 0; index < responseCount; index += 1) {
      const item = await addInputItem(ownerDb, project, admin, {
        name: `Item ${opts.roundNumber}.${index + 1}`,
      })
      responses.push(await addResponse(ownerDb, round, item, admin))
    }

    for (const [evaluator, values] of byEvaluator) {
      for (const [index, value] of values.entries()) {
        await addEvaluation(ownerDb, round, responses[index], evaluator, {
          cells: cells.map<CellFixture>((cell) => ({
            definitionId: cell.definition.id,
            criterionId: cell.criterion.id,
            value,
          })),
        })
      }
    }

    return round
  }

  const QUALITY_NOTES = {
    ana: ['high', 'high', 'high', 'medium'],
    bruno: ['high', 'high', 'medium', 'low'],
  } as const

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('quem não participa não enxerga o projeto (notFound)', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)

    auth.userId = outsider
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
    await expect(renderLayout(project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o criador/admin, um membro e um convidado pendente enxergam', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const invited = await newUser('Convidado')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    await addPendingInvitation(ownerDb, project, invited, admin)

    for (const userId of [admin, evaluator, invited]) {
      auth.userId = userId
      await expect(render(project)).resolves.toBeTruthy()
      await expect(renderLayout(project)).resolves.toBeTruthy()
    }
  })

  it('o Administrador vê o checklist de avanço, e cada pendência aponta a tela do artefato', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const tree = await render(project)
    const props = checklistOf(tree)
    expect(props).toBeTruthy()

    const pending = pendingRequirements(props!.inputs)
    expect(pending.map((r) => r.key)).toEqual(['definition', 'prompt', 'item'])

    const rendered = PipelineChecklist(props!)
    for (const req of pending) {
      expect(hasProp(rendered, 'href', `/projects/${project}/${req.route}`)).toBe(true)
    }
  })

  it('cada insumo já cadastrado resolve a sua pendência no checklist', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin, { name: 'Consulta 001' })

    auth.userId = admin
    const props = checklistOf(await render(project))!
    expect(props.inputs.promptText).toBe('Classifique a consulta.')
    expect(props.inputs.items).toBe(1)
    expect(pendingRequirements(props.inputs).map((r) => r.key)).toEqual(['definition'])
  })

  it('com os três insumos o avanço fica disponível, e some depois da Fase 1', async () => {
    const admin = await newUser('Admin')
    const phase1 = await newProject(admin)
    const phase2 = await newProject(admin, PHASE_2)

    for (const project of [phase1, phase2]) {
      await addCodebookVersion(ownerDb, project, admin)
      await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
      await addInputItem(ownerDb, project, admin)
    }

    auth.userId = admin
    const tree = await render(phase1)
    expect(checklistOf(tree)!.phase).toBe(PHASE_1)

    const liberado = advanceOf(tree)!.props as AdvanceProps
    expect(liberado.target).toBe(PHASE_2)
    expect(liberado.blocked).toBe(false)

    expect(advanceOf(await render(phase2))).toBeNull()
  })

  it('o botão de avançar fase da barra leva ao checklist da própria tela', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const phase1 = await newProject(admin)
    const phase2 = await newProject(admin, PHASE_2)
    const phase3 = await newProject(admin, PHASE_3)
    const phase4 = await newProject(admin, PHASE_4)
    await addActiveEvaluator(ownerDb, phase1, evaluator)

    async function overview(id: string, userId: string) {
      auth.userId = userId
      return render(id)
    }

    await addActiveEvaluator(ownerDb, phase2, evaluator)
    await addActiveEvaluator(ownerDb, phase3, evaluator)

    expect(hasProp(await overview(phase1, admin), 'href', '#avancar')).toBe(true)
    expect(hasProp(await overview(phase2, admin), 'href', '#avancar')).toBe(true)
    expect(hasProp(await overview(phase3, admin), 'href', '#avancar')).toBe(true)
    expect(hasProp(await overview(phase4, admin), 'href', '#avancar')).toBe(false)
    expect(hasProp(await overview(phase1, evaluator), 'href', '#avancar')).toBe(false)
    expect(hasProp(await overview(phase2, evaluator), 'href', '#avancar')).toBe(false)
    expect(hasProp(await overview(phase3, evaluator), 'href', '#avancar')).toBe(false)
  })

  it('com pendências, a barra mostra "N pendências ↓" num botão secundário; sem pendências, o primário "Avançar fase"', async () => {
    const admin = await newUser('Admin')
    const pending1 = await newProject(admin)
    const pending2 = await newProject(admin, PHASE_2)
    const ready1 = await newProject(admin)
    const ready2 = await newProject(admin, PHASE_2)

    await addCodebookVersion(ownerDb, ready1, admin)
    await addPromptVersion(ownerDb, ready1, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, ready1, admin)
    const promptVersion = await addPromptVersion(ownerDb, ready2, admin)
    await roundWith(ready2, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })

    auth.userId = admin
    async function barLinkOf(id: string) {
      const link = elementWithProp(await render(id), 'href', '#avancar')
      expect(link).toBeTruthy()
      return {
        text: deepText((link!.props as { children: unknown }).children)
          .replace(/\s+/g, ' ')
          .trim(),
        variant: (link!.props as { variant?: string }).variant,
      }
    }

    const first = await render(pending1)
    expect(pendingRequirements(checklistOf(first)!.inputs)).toHaveLength(3)
    expect(await barLinkOf(pending1)).toEqual({ text: '3 pendências ↓', variant: 'secondary' })
    expect(await barLinkOf(pending2)).toEqual({ text: '1 pendência ↓', variant: 'secondary' })

    for (const ready of [ready1, ready2]) {
      const link = await barLinkOf(ready)
      expect(link.text).toBe('Avançar fase')
      expect(link.variant).toBeUndefined()
    }
  })

  it('a ação da fase fica logo abaixo da barra, antes dos cartões de números e dos gráficos', async () => {
    const admin = await newUser('Admin')
    const phases = [PHASE_1, PHASE_2, PHASE_3, PHASE_4]
    const anchors = ['avancar', 'avancar', 'avancar', 'voltar']

    auth.userId = admin
    for (const [index, phase] of phases.entries()) {
      const project = await newProject(admin, phase)
      const promptVersion = await addPromptVersion(ownerDb, project, admin)
      await roundWith(project, admin, promptVersion, {
        roundNumber: 1,
        versionNumber: 1,
        phase: PHASE_2,
      })

      const tree = await render(project)
      const bar = findElement(tree, PhaseBar)!
      const siblings = [(parentOf(tree, bar)!.props as { children: unknown }).children]
        .flat(Infinity)
        .filter(isValidElement)
      const at = siblings.indexOf(bar)
      const action = siblings[at + 1]
      expect((action.props as { id?: string }).id).toBe(anchors[index])
      expect(siblings.indexOf(gridOf(tree))).toBeGreaterThan(at + 1)
      expect(siblings.indexOf(sectionWith(tree, AgreementSeriesChart)!)).toBeGreaterThan(at + 1)
    }
  })

  it('só o painel da fase atual fica aberto; os das fases anteriores vão para "Fases concluídas (N)", fechado', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const phase1 = await newProject(admin)
    const phase2 = await newProject(admin, PHASE_2)
    const phase3 = await newProject(admin, PHASE_3)
    const phase4 = await newProject(admin, PHASE_4)
    await addActiveEvaluator(ownerDb, phase4, evaluator)

    async function panelsOf(id: string, userId = admin) {
      auth.userId = userId
      const tree = await render(id)
      const disclosure = findElement(tree, Disclosure)
      const props = disclosure?.props as
        | { summary: unknown; defaultOpen?: boolean; children: unknown }
        | undefined
      return {
        avancar: elementWithProp(tree, 'id', 'avancar'),
        voltar: elementWithProp(tree, 'id', 'voltar'),
        summary: props?.summary,
        defaultOpen: props?.defaultOpen,
        completed: props ? typesOf(props.children) : [],
      }
    }

    const first = await panelsOf(phase1)
    expect(findElement(first.avancar, PipelineChecklist)).toBeTruthy()
    expect(first.summary).toBeUndefined()

    const second = await panelsOf(phase2)
    expect(findElement(second.avancar, Phase2Checklist)).toBeTruthy()
    expect(findElement(second.avancar, PipelineChecklist)).toBeNull()
    expect(second.summary).toBe('Fases concluídas (1)')
    expect(second.defaultOpen).toBeFalsy()
    expect(second.completed).toEqual([PipelineChecklist])

    const third = await panelsOf(phase3)
    expect(findElement(third.avancar, Phase3Checklist)).toBeTruthy()
    expect(findElement(third.avancar, Phase2Checklist)).toBeNull()
    expect(third.summary).toBe('Fases concluídas (2)')
    expect(third.completed).toEqual([PipelineChecklist, Phase2Checklist])

    const fourth = await panelsOf(phase4)
    expect(fourth.avancar).toBeNull()
    expect(findElement(fourth.voltar, Phase4Return)).toBeTruthy()
    expect(findElement(fourth.voltar, Phase3Checklist)).toBeNull()
    expect(fourth.summary).toBe('Fases concluídas (3)')
    expect(fourth.defaultOpen).toBeFalsy()
    expect(fourth.completed).toEqual([PipelineChecklist, Phase2Checklist, Phase3Checklist])

    const asEvaluator = await panelsOf(phase4, evaluator)
    expect(asEvaluator.summary).toBeUndefined()
    expect(asEvaluator.voltar).toBeNull()
  })

  it('na Fase 4, a barra de fases mostra ao Administrador o selo de codebook e prompt congelados', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const phase3 = await newProject(admin, PHASE_3)
    const phase4 = await newProject(admin, PHASE_4)
    const archived = await newProject(admin, PHASE_4)
    await ownerDb.update(projects).set({ status: 'archived' }).where(eq(projects.id, archived))
    await addActiveEvaluator(ownerDb, phase4, evaluator)

    async function badgeOf(id: string, userId = admin) {
      auth.userId = userId
      const bar = findElement(await render(id), PhaseBar)
      expect(bar).toBeTruthy()
      return (bar!.props as { badge?: unknown }).badge ?? null
    }

    const badge = await badgeOf(phase4)
    expect(findElement(badge, Badge)).toBeTruthy()
    expect((findElement(badge, Badge)!.props as { tone?: string }).tone ?? 'neutral').toBe(
      'neutral',
    )
    expect(deepText(findElement(badge, Badge)).trim()).toBe(FROZEN_BADGE_LABEL)
    expect((findElement(badge, InfoTooltip)!.props as { text: string }).text).toBe(
      FROZEN_BADGE_HELP,
    )

    expect(await badgeOf(phase3)).toBeNull()
    expect(await badgeOf(phase4, evaluator)).toBeNull()
    expect(await badgeOf(archived)).toBeNull()
  })

  it('os quatro cartões de números ficam numa grade só', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = admin
    const grid = gridOf(await render(project))
    expect(typesOf((grid.props as { children: unknown }).children)).toEqual([
      StatCard,
      StatCard,
      StatCard,
      StatCard,
    ])
    expect((grid.props as { className: string }).className).toContain('lg:grid-cols-4')

    auth.userId = evaluator
    const alone = gridOf(await render(project))
    expect(typesOf((alone.props as { children: unknown }).children)).toEqual([StatCard])
  })

  it('na Fase 2, com uma rodada fechada, o avanço para a Fase 3 aparece liberado e mostra o ICR da última rodada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      byEvaluator: {
        [ana]: ['low', 'medium', 'high'],
        [bruno]: ['low', 'medium', 'high'],
      },
    })

    auth.userId = admin
    const tree = await render(project)

    const advance = phase2AdvanceOf(tree)
    expect(advance).toBeTruthy()
    expect(advance!.target).toBe(PHASE_3)
    expect(advance!.blocked).toBe(false)

    const last = phase2Of(tree)!.lastRound
    expect(last?.roundNumber).toBe(1)
    if (!last?.pair.all.calculable) throw new Error('a rodada deveria ter coeficiente')

    const text = phase2TextOf(tree)
    expect(text).toContain('Última rodada fechada: rodada 1')
    expect(text).toContain(formatAlpha(last.pair.all.alpha))
    expect(text).toContain(bandLabel(agreementBand(last.pair.all.alpha)))
    expect(text).toContain(BAND_REFERENCE)
    expect(text).toContain('A decisão de avançar é do Administrador.')
    expect(text).toContain(
      'Tudo pronto. O avanço pede confirmação antes de mudar qualquer coisa.',
    )
    expect(text).not.toContain('Nenhuma rodada aberta e ao menos uma fechada')
  })

  it('na Fase 2, a rodada aberta trava o avanço e o painel a nomeia', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      status: 'open',
    })

    auth.userId = admin
    const tree = await render(project)

    expect(phase2Of(tree)!.inputs).toEqual({ openRoundNumber: 2, closedRounds: 1 })
    expect(phase2AdvanceOf(tree)!.blocked).toBe(true)

    const text = phase2TextOf(tree)
    expect(text).toContain('A rodada 2 ainda está aberta')
    expect(text).not.toContain('Nenhuma rodada foi fechada nesta fase')
  })

  it('na Fase 2 sem nenhuma rodada, o avanço trava pela rodada fechada que falta', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)

    auth.userId = admin
    const tree = await render(project)

    expect(phase2Of(tree)!.lastRound).toBeNull()
    expect(phase2AdvanceOf(tree)!.blocked).toBe(true)
    expect(phase2TextOf(tree)).toContain('Nenhuma rodada foi fechada nesta fase')
  })

  it('o ICR não calculável da última rodada não trava o avanço', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      byEvaluator: { [ana]: ['low', 'medium', 'high'] },
    })

    auth.userId = admin
    const tree = await render(project)

    expect(phase2Of(tree)!.lastRound!.pair.all.calculable).toBe(false)
    expect(phase2AdvanceOf(tree)!.blocked).toBe(false)
    expect(phase2TextOf(tree)).toContain(NOT_CALCULABLE_LABEL)
  })

  it('o ICR baixo da última rodada aparece como questionável e não trava o avanço', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      byEvaluator: {
        [ana]: ['low', 'medium', 'high'],
        [bruno]: ['high', 'medium', 'low'],
      },
    })

    auth.userId = admin
    const tree = await render(project)

    const all = phase2Of(tree)!.lastRound!.pair.all
    if (!all.calculable) throw new Error('a rodada deveria ter coeficiente')
    expect(all.alpha).toBeLessThan(AGREEMENT_BANDS.acceptable)

    expect(phase2AdvanceOf(tree)!.blocked).toBe(false)

    const text = phase2TextOf(tree)
    expect(text).toContain(formatAlpha(all.alpha))
    expect(text).toContain(bandLabel('questionable'))
  })

  it('na Fase 3 o painel diz que a Fase 2 foi concluída e não oferece avanço', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })

    auth.userId = admin
    const tree = await render(project)

    expect(phase2Of(tree)).toBeTruthy()
    expect(phase2AdvanceOf(tree)).toBeNull()
    expect(phase2TextOf(tree)).toContain(`Fase ${PHASE_2} concluída`)
  })

  it('o avaliador não vê o painel de avanço para a Fase 3, nem na Fase 2 nem na Fase 3', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')

    for (const phase of [PHASE_2, PHASE_3]) {
      const project = await newProject(admin, phase)
      await addActiveEvaluator(ownerDb, project, evaluator)

      auth.userId = evaluator
      const tree = await render(project)
      expect(phase2Of(tree)).toBeNull()
      expect(deepText(tree)).not.toContain('Concordância')
    }
  })

  it('na Fase 3, com uma rodada fechada da Fase 3, o avanço para a Fase 4 aparece liberado com o ICR e a Qualidade da última rodada da Fase 3', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      phase: PHASE_2,
      byEvaluator: {
        [ana]: ['low', 'medium', 'high'],
        [bruno]: ['low', 'medium', 'high'],
      },
    })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      phase: PHASE_3,
      byEvaluator: { [ana]: QUALITY_NOTES.ana, [bruno]: QUALITY_NOTES.bruno },
    })

    auth.userId = admin
    const tree = await render(project)

    const advance = phase3AdvanceOf(tree)
    expect(advance).toBeTruthy()
    expect(advance!.target).toBe(PHASE_4)
    expect(advance!.blocked).toBe(false)
    expect(advance!.lines).toEqual(phase4ConfirmationLines())

    expect(phase2Of(tree)!.lastRound?.roundNumber).toBe(1)
    expect(phase2Of(tree)!.lastRound?.quality).toBeUndefined()

    const last = phase3Of(tree)!.lastRound
    expect(last?.roundNumber).toBe(2)
    expect(phase3Of(tree)!.inputs).toEqual({
      openRoundNumber: null,
      closedRounds: 1,
      versions: {
        referenceRound: 2,
        reference: { codebook: 2, prompt: 1 },
        current: { codebook: 2, prompt: 1 },
      },
    })
    if (!last?.pair.all.calculable) throw new Error('a rodada deveria ter coeficiente')
    expect(last.quality).toEqual(qualityOf(await renderRounds(project)).pair)

    const text = phase3TextOf(tree)
    expect(text).toContain('Rodada de referência: rodada 2')
    expect(text).toContain(
      `Codebook na versão 2 e prompt na versão 1: são as versões que a Fase ${PHASE_4} vai testar.`,
    )
    expect(text).not.toContain('Última rodada fechada')
    expect(text).toContain(formatAlpha(last.pair.all.alpha))
    expect(text).toContain(bandLabel(agreementBand(last.pair.all.alpha)))
    expect(text).toContain(BAND_REFERENCE)
    expect(text).toContain('Alto 62,5% (5) · Médio 25% (2) · Baixo 12,5% (1)')
    expect(text).toContain(
      'Tudo pronto. O avanço pede confirmação antes de mudar qualquer coisa.',
    )
    expect(text).not.toContain('são os da rodada de referência')
    expect(text).toContain('8 notas')
    expect(text).toContain(QUALITY_REFERENCE)
    expect(text).toContain('A decisão de avançar é do Administrador.')
  })

  it('na Fase 3, a rodada aberta trava o avanço para a Fase 4 e o painel a nomeia', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      phase: PHASE_3,
    })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 3,
      versionNumber: 3,
      phase: PHASE_3,
      status: 'open',
    })

    auth.userId = admin
    const tree = await render(project)

    expect(phase3Of(tree)!.inputs).toEqual({
      openRoundNumber: 3,
      closedRounds: 1,
      versions: {
        referenceRound: 2,
        reference: { codebook: 2, prompt: 1 },
        current: { codebook: 3, prompt: 1 },
      },
    })
    expect(phase3AdvanceOf(tree)!.blocked).toBe(true)

    const text = phase3TextOf(tree)
    expect(text).toContain(phase3BlockerMessage({ key: 'open_round', roundNumber: 3 }))
    expect(text).not.toContain(phase3BlockerMessage({ key: 'no_closed_round' }))
  })

  it('na Fase 3, as rodadas fechadas da Fase 2 não liberam o avanço para a Fase 4', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })
    await roundWith(project, admin, promptVersion, { roundNumber: 2, versionNumber: 2 })

    auth.userId = admin
    const tree = await render(project)

    expect(phase2Of(tree)!.inputs).toEqual({ openRoundNumber: null, closedRounds: 2 })
    expect(phase3Of(tree)!.inputs).toEqual({
      openRoundNumber: null,
      closedRounds: 0,
      versions: null,
    })
    expect(phase3Of(tree)!.lastRound).toBeNull()
    expect(phase3AdvanceOf(tree)!.blocked).toBe(true)
    expect(phase3TextOf(tree)).toContain(phase3BlockerMessage({ key: 'no_closed_round' }))
  })

  it('na Fase 3, com codebook e prompt iguais aos da rodada de referência, o item das versões aparece pronto', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      phase: PHASE_3,
    })

    auth.userId = admin
    const tree = await render(project)

    expect(phase3AdvanceOf(tree)!.blocked).toBe(false)

    const text = phase3TextOf(tree)
    expect(text).toContain('Codebook e prompt iguais aos da rodada de referência pronto')
    expect(text).toContain('tudo pronto')
    expect(text).not.toContain('Resolver')
    expect(text).not.toContain('Depende da rodada de referência')
    expect(text).toContain(
      'Tudo pronto. O avanço pede confirmação antes de mudar qualquer coisa.',
    )
  })

  it.each([
    {
      subject: 'codebook' as const,
      seed: (project: string, admin: string) =>
        addCodebookVersion(ownerDb, project, admin, { versionNumber: 3 }),
      changes: [{ subject: 'codebook' as const, reference: 2, current: 3 }],
    },
    {
      subject: 'prompt' as const,
      seed: (project: string, admin: string) =>
        addPromptVersion(ownerDb, project, admin, { versionNumber: 2 }),
      changes: [{ subject: 'prompt' as const, reference: 1, current: 2 }],
    },
  ])(
    'na Fase 3, o $subject mudado depois da rodada de referência trava o avanço e o item aponta as rodadas',
    async ({ seed, changes }) => {
      const admin = await newUser('Admin')
      const project = await newProject(admin, PHASE_3)
      const promptVersion = await addPromptVersion(ownerDb, project, admin)
      await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })
      await roundWith(project, admin, promptVersion, {
        roundNumber: 2,
        versionNumber: 2,
        phase: PHASE_3,
      })
      await seed(project, admin)

      auth.userId = admin
      const tree = await render(project)

      expect(phase3AdvanceOf(tree)!.blocked).toBe(true)

      const props = phase3Of(tree)!
      expect(props.inputs.versions?.referenceRound).toBe(2)
      expect(hasProp(Phase3Checklist(props), 'href', `/projects/${project}/rounds`)).toBe(true)

      const text = phase3TextOf(tree)
      expect(text).toContain(
        phase3BlockerMessage({ key: 'versions_changed', referenceRound: 2, changes }),
      )
      expect(text).toContain('1 de 3 pendentes')
      expect(text.match(/Resolver/g)).toHaveLength(1)
    },
  )

  it('na Fase 3 sem rodada fechada da Fase 3, o item das versões fica neutro e fora da contagem', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })

    auth.userId = admin
    const tree = await render(project)

    expect(phase3Of(tree)!.inputs.versions).toBeNull()
    expect(phase3AdvanceOf(tree)!.blocked).toBe(true)

    const text = phase3TextOf(tree)
    expect(text).toContain(
      `Depende da rodada de referência, a última rodada fechada da Fase ${PHASE_3}, que ainda não existe.`,
    )
    expect(text).not.toContain('Codebook e prompt iguais aos da rodada de referência pronto')
    expect(text).toContain('1 de 3 pendentes')
    expect(text).toContain('Falta 1 pendência')
    expect(text.match(/Resolver/g)).toHaveLength(1)
  })

  it('na Fase 3, o ICR baixo e a Qualidade toda em Baixo não travam o avanço para a Fase 4', async () => {
    const admin = await newUser('Admin')
    const scenes = {
      lowAgreement: {
        ana: ['low', 'medium', 'high'],
        bruno: ['high', 'medium', 'low'],
      },
      allLow: { ana: ['low', 'low', 'low'], bruno: ['low', 'low', 'low'] },
    } as const
    const trees: Record<keyof typeof scenes, unknown> = {
      lowAgreement: null,
      allLow: null,
    }

    for (const key of Object.keys(scenes) as (keyof typeof scenes)[]) {
      const project = await newProject(admin, PHASE_3)
      const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
      const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
      const promptVersion = await addPromptVersion(ownerDb, project, admin)
      await roundWith(project, admin, promptVersion, {
        roundNumber: 1,
        versionNumber: 1,
        phase: PHASE_3,
        byEvaluator: { [ana]: scenes[key].ana, [bruno]: scenes[key].bruno },
      })

      auth.userId = admin
      trees[key] = await render(project)
      expect(phase3AdvanceOf(trees[key])!.blocked).toBe(false)
    }

    const lowAgreement = phase3Of(trees.lowAgreement)!.lastRound!.pair.all
    if (!lowAgreement.calculable) throw new Error('a rodada deveria ter coeficiente')
    expect(lowAgreement.alpha).toBeLessThan(AGREEMENT_BANDS.acceptable)
    expect(phase3TextOf(trees.lowAgreement)).toContain(bandLabel('questionable'))

    const allLow = phase3Of(trees.allLow)!.lastRound!
    expect(allLow.pair.all.calculable).toBe(false)
    if (!allLow.quality?.all.rated) throw new Error('a rodada deveria ter notas')
    expect(allLow.quality.all.levels.find((level) => level.value === 'low')?.share).toBe(1)
    expect(phase3TextOf(trees.allLow)).toContain('Baixo 100% (6)')
  })

  it('na Fase 4 o painel diz que a Fase 3 foi concluída, não oferece avanço e não fala em retorno', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_4)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      phase: PHASE_3,
    })

    auth.userId = admin
    const tree = await render(project)

    expect(phase2AdvanceOf(tree)).toBeNull()
    expect(phase3Of(tree)).toBeTruthy()
    expect(phase3AdvanceOf(tree)).toBeNull()

    const text = phase3TextOf(tree)
    expect(text).toContain(`Fase ${PHASE_3} concluída`)
    expect(text).toContain('continuam aqui para consulta')
    expect(text).not.toMatch(/\b(voltar|volta|retorno|retornar)\b/i)
  })

  it('o painel da Fase 2 lê só as rodadas da Fase 2: a rodada aberta da Fase 3 não vira pendência dele', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      phase: PHASE_3,
      status: 'open',
    })

    auth.userId = admin
    const tree = await render(project)

    expect(phase2Of(tree)!.inputs).toEqual({ openRoundNumber: null, closedRounds: 1 })
    expect(phase2TextOf(tree)).not.toContain(
      phase2BlockerMessage({ key: 'open_round', roundNumber: 2 }),
    )
    expect(phase3Of(tree)!.inputs).toEqual({
      openRoundNumber: 2,
      closedRounds: 0,
      versions: null,
    })
  })

  it('o avaliador não vê o painel de avanço para a Fase 4, nem na Fase 3 nem na Fase 4', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')

    for (const phase of [PHASE_3, PHASE_4]) {
      const project = await newProject(admin, phase)
      await addActiveEvaluator(ownerDb, project, evaluator)
      const promptVersion = await addPromptVersion(ownerDb, project, admin)
      await roundWith(project, admin, promptVersion, {
        roundNumber: 1,
        versionNumber: 1,
        phase: PHASE_3,
      })

      auth.userId = evaluator
      const tree = await render(project)
      expect(phase3Of(tree)).toBeNull()
      expect(hasProp(tree, 'href', '#avancar')).toBe(false)
      expect(deepText(tree)).not.toContain('Qualidade')
    }
  })

  it('o avaliador não vê o checklist nem os resumos dos artefatos', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const tree = await render(project)
    expect(checklistOf(tree)).toBeNull()
    expect(hasProp(tree, 'href', `/projects/${project}/codebook`)).toBe(false)
  })

  it('a visão geral vista pelo avaliador não fala de concordância, nem com rodada avaliada', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin, PHASE_2)
    const ana = await addActiveEvaluator(ownerDb, project, evaluator)
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      byEvaluator: {
        [ana]: ['low', 'medium', 'high'],
        [bruno]: ['low', 'medium', 'high'],
      },
    })

    auth.userId = admin
    expect(seriesOf(await render(project)).points).toHaveLength(1)

    auth.userId = evaluator
    const tree = await render(project)
    expect(findElement(tree, AgreementSeriesChart)).toBeNull()

    const page = deepText(tree)
    expect(page).not.toContain('Krippendorff')
    expect(page).not.toContain('ICR')
    expect(page).not.toContain('Concordância')
  })

  it('o Administrador vê a Qualidade da rodada da Fase 3 na visão geral, com os valores da tela de rodadas', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      phase: PHASE_3,
      byEvaluator: { [ana]: QUALITY_NOTES.ana, [bruno]: QUALITY_NOTES.bruno },
    })

    auth.userId = admin
    const tree = await render(project)

    const pair = qualityOf(tree).pair
    expect(pair).toEqual({
      all: {
        rated: true,
        total: 8,
        levels: [
          { value: 'high', count: 5, share: 0.625 },
          { value: 'medium', count: 2, share: 0.25 },
          { value: 'low', count: 1, share: 0.125 },
        ],
      },
      withoutOutliers: null,
      excluded: 0,
    })
    expect(pair).toEqual(qualityOf(await renderRounds(project)).pair)

    const text = qualityTextOf(tree)
    expect(text).toContain('Alto 62,5% (5)')
    expect(text).toContain('Médio 25% (2)')
    expect(text).toContain('Baixo 12,5% (1)')

    const section = sectionWith(tree, QualityPanel)
    expect((section!.props as { title: unknown }).title).toBe(
      'Qualidade na rodada 1, fechada',
    )
    expect(findElement(section, AgreementSeriesChart)).toBeNull()
    expect(sectionWith(tree, AgreementSeriesChart)).not.toBe(section)
    expect(hasProp(section, 'href', `/projects/${project}/rounds`)).toBe(false)
    expect(roundsLinksOf(tree, project)).toHaveLength(1)
  })

  it('com uma rodada fechada da Fase 2 e uma aberta da Fase 3, a visão geral tem um só "Abrir rodadas →", depois da Concordância e da Qualidade, e não repete a Qualidade por rodada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    const byEvaluator = { [ana]: QUALITY_NOTES.ana, [bruno]: QUALITY_NOTES.bruno }

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      phase: PHASE_2,
      byEvaluator,
    })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      phase: PHASE_3,
      status: 'open',
      byEvaluator,
    })

    auth.userId = admin
    const tree = await render(project)

    expect(findElement(tree, QualityPanel)).toBeTruthy()
    expect(findElement(tree, QualitySeriesList)).toBeNull()
    expect(deepText(tree)).not.toContain('Qualidade por rodada')

    const links = roundsLinksOf(tree, project)
    expect(links).toHaveLength(1)
    expect((links[0].props as { children: unknown }).children).toBe('Abrir rodadas →')
    expect(seriesMarkupOf(tree)).not.toContain('Abrir rodadas')
    expect(hasProp(sectionWith(tree, QualityPanel), 'href', `/projects/${project}/rounds`)).toBe(
      false,
    )

    const page = deepText(tree)
    expect(page.indexOf('Concordância por rodada')).toBeLessThan(page.indexOf('Abrir rodadas →'))
    expect(page.indexOf('Qualidade na rodada 2')).toBeLessThan(page.indexOf('Abrir rodadas →'))
  })

  it('a visão geral não mostra Qualidade quando a rodada em foco é da Fase 2, mesmo com o projeto na Fase 3', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      phase: PHASE_2,
      byEvaluator: { [ana]: QUALITY_NOTES.ana, [bruno]: QUALITY_NOTES.bruno },
    })

    auth.userId = admin
    const tree = await render(project)

    expect(findElement(tree, QualityPanel)).toBeNull()
    expect(findElement(tree, QualitySeriesList)).toBeNull()
    expect(deepText(tree)).not.toContain('Qualidade')
    expect(seriesOf(tree).points).toHaveLength(1)
  })

  it('o Avaliador não vê a Qualidade na visão geral, com a rodada da Fase 3 aberta nem depois de fechada', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin, PHASE_3)
    const ana = await addActiveEvaluator(ownerDb, project, evaluator)
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    const round = await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      phase: PHASE_3,
      status: 'open',
      byEvaluator: { [ana]: QUALITY_NOTES.ana, [bruno]: QUALITY_NOTES.bruno },
    })

    async function expectNoQuality() {
      auth.userId = admin
      const adminTree = await render(project)
      expect(qualityOf(adminTree).pair.all).toMatchObject({ total: 8 })
      expect(findElement(adminTree, QualitySeriesList)).toBeNull()
      expect(findElement(await renderRounds(project), QualityMatrixTable)).toBeTruthy()

      auth.userId = evaluator
      const tree = await render(project)
      expect(findElement(tree, QualityPanel)).toBeNull()
      expect(findElement(tree, QualitySeriesList)).toBeNull()
      expect(findElement(tree, QualityMatrixTable)).toBeNull()
      const page = deepText(tree)
      expect(page).not.toContain('Qualidade')
      expect(page).not.toContain('%')

      const roundsTree = await renderRounds(project)
      expect(findElement(roundsTree, QualityMatrixTable)).toBeNull()
      expect(findElement(roundsTree, QualityPanel)).toBeNull()
    }

    await expectNoQuality()

    await ownerDb
      .update(rounds)
      .set({ status: 'closed', closedAt: new Date().toISOString() })
      .where(eq(rounds.id, round))

    await expectNoQuality()
  })

  async function qualitySeriesScene(admin: string) {
    const project = await newProject(admin, PHASE_3)
    const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptV1 = await addPromptVersion(ownerDb, project, admin)
    const promptV2 = await addPromptVersion(ownerDb, project, admin, { versionNumber: 2 })

    const byEvaluator = { [ana]: QUALITY_NOTES.ana, [bruno]: QUALITY_NOTES.bruno }
    for (const roundNumber of [1, 2]) {
      await roundWith(project, admin, promptV1, {
        roundNumber,
        versionNumber: roundNumber,
        phase: PHASE_2,
        byEvaluator,
      })
    }
    const third = await roundWith(project, admin, promptV1, {
      roundNumber: 3,
      versionNumber: 3,
      phase: PHASE_3,
      byEvaluator,
    })
    const fourth = await roundWith(project, admin, promptV2, {
      roundNumber: 4,
      versionNumber: 4,
      phase: PHASE_3,
      status: 'open',
      byEvaluator: { [ana]: ['low', 'low'], [bruno]: ['low', 'medium'] },
    })

    return { project, ana, bruno, third, fourth }
  }

  it('o Administrador vê a série de Qualidade com um ponto por rodada da Fase 3, cada um com as suas versões', async () => {
    const admin = await newUser('Admin')
    const { project } = await qualitySeriesScene(admin)

    auth.userId = admin
    const tree = await render(project)

    const points = qualitySeriesOf(tree).points
    expect(points.map((point) => point.roundNumber)).toEqual([3, 4])
    expect(points.map((point) => point.codebookVersionNumber)).toEqual([3, 4])
    expect(points.map((point) => point.promptVersionNumber)).toEqual([1, 2])
    expect(points.map((point) => point.pair.withoutOutliers)).toEqual([null, null])

    const text = qualitySeriesTextOf(tree)
    expect(text).toContain('Rodada 3')
    expect(text).toContain('Rodada 4')
    expect(text.indexOf('Rodada 3')).toBeLessThan(text.indexOf('Rodada 4'))
    expect(text).toContain('Codebook v3')
    expect(text).toContain('Codebook v4')
    expect(text).toContain('Prompt v1')
    expect(text).toContain('Prompt v2')
    expect(text).toContain('Alto 62,5% (5) · Médio 25% (2) · Baixo 12,5% (1)')
    expect(text).toContain('Alto 0% (0) · Médio 25% (1) · Baixo 75% (3)')
    expect(text).toContain('aberta')
    expect(text).not.toContain(AGREEMENT_ALL_LABEL)
    expect(text).not.toContain('média')
    expect(text).toContain(QUALITY_SERIES_NOTE)

    const { bars, numbers } = qualitySeriesPartsOf(tree)
    expect(bars).toContain('title="Alto 62,5% (5) · Médio 25% (2) · Baixo 12,5% (1) · 8 notas"')
    expect(bars).toContain('title="Alto 0% (0) · Médio 25% (1) · Baixo 75% (3) · 4 notas"')
    expect(bars.match(/class="h-full bg-quality-[a-z]+"/g)).toHaveLength(6)
    expect(textOfMarkup(bars)).not.toContain('%')
    expect(textOfMarkup(bars)).toContain('Alto · Médio · Baixo')
    expect(textOfMarkup(bars)).toContain('Codebook v3 · Prompt v1')

    expect(numbers.startsWith('<details class="group">')).toBe(true)
    const numbersText = textOfMarkup(numbers)
    expect(numbersText.startsWith(QUALITY_SERIES_NUMBERS)).toBe(true)
    expect(numbersText).toContain('Alto 62,5% (5) · Médio 25% (2) · Baixo 12,5% (1) 8 notas')
    expect(numbersText).toContain('Alto 0% (0) · Médio 25% (1) · Baixo 75% (3) 4 notas')
    expect(numbersText.indexOf('Rodada 3')).toBeLessThan(numbersText.indexOf('Rodada 4'))

    const section = sectionWith(tree, QualitySeriesList)
    expect((section!.props as { title: unknown }).title).toBe('Qualidade por rodada')
    expect(section).not.toBe(sectionWith(tree, QualityPanel))
    expect(section).not.toBe(sectionWith(tree, AgreementSeriesChart))
    expect(qualitySeriesMarkupOf(tree)).not.toContain(`href="/projects/${project}/rounds"`)
    expect(roundsLinksOf(tree, project)).toHaveLength(1)
    const page = deepText(tree)
    expect(page.indexOf('Qualidade por rodada')).toBeLessThan(page.indexOf('Abrir rodadas →'))
  })

  it('as rodadas da Fase 2 não entram na série de Qualidade, e continuam na de Concordância', async () => {
    const admin = await newUser('Admin')
    const { project } = await qualitySeriesScene(admin)

    auth.userId = admin
    const tree = await render(project)

    const text = qualitySeriesTextOf(tree)
    expect(text).not.toContain('Rodada 1')
    expect(text).not.toContain('Rodada 2')
    expect(text).not.toContain('Codebook v1')
    expect(text).not.toContain('Codebook v2')

    expect(seriesOf(tree).points.map((point) => point.roundNumber)).toEqual([1, 2, 3, 4])
  })

  it('o ponto da série tem os mesmos valores da Qualidade da tela de rodadas', async () => {
    const admin = await newUser('Admin')
    const { project, bruno, fourth } = await qualitySeriesScene(admin)
    await addOutlier(ownerDb, fourth, bruno, admin)

    auth.userId = admin
    const tree = await render(project)
    const focusPoint = qualitySeriesOf(tree).points.at(-1)!

    expect(focusPoint.roundNumber).toBe(4)
    expect(focusPoint.pair).toEqual(qualityOf(await renderRounds(project)).pair)
    expect(focusPoint.pair).toEqual(qualityOf(tree).pair)
  })

  it('com outlier marcado numa rodada, só o ponto dela traz o par, com todos primeiro', async () => {
    const admin = await newUser('Admin')
    const { project, bruno, third } = await qualitySeriesScene(admin)
    await addOutlier(ownerDb, third, bruno, admin)

    auth.userId = admin
    const tree = await render(project)

    const [marked, unmarked] = qualitySeriesOf(tree).points
    expect(marked.pair.withoutOutliers).toEqual({
      rated: true,
      total: 4,
      levels: [
        { value: 'high', count: 3, share: 0.75 },
        { value: 'medium', count: 1, share: 0.25 },
        { value: 'low', count: 0, share: 0 },
      ],
    })
    expect(marked.pair.all).toMatchObject({ rated: true, total: 8 })
    expect(unmarked.pair.withoutOutliers).toBeNull()

    const { bars, numbers } = qualitySeriesPartsOf(tree)
    const markedBars = bars.slice(bars.indexOf('Rodada 3'), bars.indexOf('Rodada 4'))
    const unmarkedBars = bars.slice(bars.indexOf('Rodada 4'))
    const allBar = markedBars.indexOf(
      `title="${AGREEMENT_ALL_LABEL}: Alto 62,5% (5) · Médio 25% (2) · Baixo 12,5% (1) · 8 notas"`,
    )
    const withoutBar = markedBars.indexOf(
      `title="${AGREEMENT_WITHOUT_OUTLIERS_LABEL}: Alto 75% (3) · Médio 25% (1) · Baixo 0% (0) · 4 notas"`,
    )

    expect(allBar).toBeGreaterThan(0)
    expect(withoutBar).toBeGreaterThan(allBar)
    expect(markedBars.slice(allBar, withoutBar)).toContain('h-2')
    expect(markedBars.slice(allBar, withoutBar)).not.toContain('h-1.5')
    expect(markedBars.slice(withoutBar)).toContain('h-1.5')
    expect(textOfMarkup(markedBars.slice(withoutBar))).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(unmarkedBars).not.toContain(AGREEMENT_ALL_LABEL)
    expect(unmarkedBars).not.toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)

    const text = textOfMarkup(numbers)
    const markedText = text.slice(text.indexOf('Rodada 3'), text.indexOf('Rodada 4'))
    const unmarkedText = text.slice(text.indexOf('Rodada 4'))

    expect(markedText).toContain(AGREEMENT_ALL_LABEL)
    expect(markedText).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(markedText.indexOf(AGREEMENT_ALL_LABEL)).toBeLessThan(
      markedText.indexOf(AGREEMENT_WITHOUT_OUTLIERS_LABEL),
    )
    expect(markedText).toContain('Alto 62,5% (5)')
    expect(markedText).toContain('Alto 75% (3)')
    expect(unmarkedText).not.toContain(AGREEMENT_ALL_LABEL)
    expect(unmarkedText).not.toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
  })

  it('duas versões de codebook viram dois pontos, e nada na tela junta os dois', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const ana = await addActiveEvaluator(ownerDb, project, await newUser('Ana'))
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      byEvaluator: {
        [ana]: ['low', 'medium', 'high'],
        [bruno]: ['low', 'medium', 'high'],
      },
    })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      status: 'open',
      byEvaluator: {
        [ana]: ['low', 'medium', 'high'],
        [bruno]: ['high', 'medium', 'low'],
      },
    })

    auth.userId = admin
    const tree = await render(project)

    const points = seriesOf(tree).points
    expect(points.map((point) => point.roundNumber)).toEqual([1, 2])
    expect(points.map((point) => point.codebookVersionNumber)).toEqual([1, 2])

    const [first, second] = points
    if (!first.agreement.calculable || !second.agreement.calculable) {
      throw new Error('as duas rodadas deveriam ter coeficiente')
    }
    expect(first.agreement.alpha).not.toBe(second.agreement.alpha)

    const text = seriesTextOf(tree)
    expect(text).toContain(formatAlpha(first.agreement.alpha))
    expect(text).toContain(formatAlpha(second.agreement.alpha))
    expect(text).toContain('Codebook v1')
    expect(text).toContain('Codebook v2')

    const mean = (first.agreement.alpha + second.agreement.alpha) / 2
    expect(text).not.toContain(formatAlpha(mean))
    expect(text).not.toContain('média')
    expect(text).not.toContain('no total')
  })

  it('a rodada sem avaliação continua na série, como ponto não calculável', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, { roundNumber: 1, versionNumber: 1 })

    auth.userId = admin
    const tree = await render(project)

    expect(seriesOf(tree).points).toHaveLength(1)
    expect(seriesOf(tree).points[0].agreement).toMatchObject({ calculable: false })

    const text = seriesTextOf(tree)
    expect(text).toContain('Rodada 1')
    expect(text).toContain('não calculável')
    expect(text).not.toContain('0,000')
  })

  it('a legenda da série de Concordância fica em "Como ler este gráfico", fechado, e a nota de exclusão só entra com marcado', async () => {
    const admin = await newUser('Admin')
    const { project, bruno, third } = await qualitySeriesScene(admin)

    auth.userId = admin
    const before = seriesOf(await render(project))
    const plain = findElement(AgreementSeriesChart(before), HowToRead)
    expect(findElement(AgreementSeriesChart(before), InfoTooltip)).toBeNull()
    expect(plain).toBeTruthy()
    expect((plain!.props as { summary: string }).summary).toBe('Como ler este gráfico')
    expect((plain!.props as { paragraphs: string[] }).paragraphs).toEqual([BAND_REFERENCE])

    await addOutlier(ownerDb, third, bruno, admin)
    const after = seriesOf(await render(project))
    const marked = findElement(AgreementSeriesChart(after), HowToRead)
    const paragraphs = (marked!.props as { paragraphs: string[] }).paragraphs
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]).toBe(BAND_REFERENCE)
    expect(paragraphs[1]).toContain('A série desenha sempre o valor com todos')

    const markup = renderToStaticMarkup(createElement(AgreementSeriesChart, after))
    expect(markup).toContain('Como ler este gráfico')
    expect(markup).not.toMatch(/<details[^>]*\sopen/)
    expect(textOfMarkup(markup)).toContain(
      'Um ponto por rodada, e nenhum valor que junte rodadas',
    )
  })

  it('os pontos da série aparecem em ordem cronológica', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    for (const roundNumber of [1, 2, 3]) {
      await roundWith(project, admin, promptVersion, {
        roundNumber,
        versionNumber: roundNumber,
        status: roundNumber === 3 ? 'open' : 'closed',
      })
    }

    auth.userId = admin
    const text = seriesTextOf(await render(project))

    expect(text.indexOf('Rodada 1')).toBeLessThan(text.indexOf('Rodada 2'))
    expect(text.indexOf('Rodada 2')).toBeLessThan(text.indexOf('Rodada 3'))
  })

  it('a série vazia diz que ela começa na primeira rodada, e leva às rodadas', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)

    auth.userId = admin
    const tree = await render(project)

    expect(seriesOf(tree).points).toEqual([])
    expect(seriesTextOf(tree)).toContain('começa na primeira rodada')
    expect(seriesMarkupOf(tree)).not.toContain(`href="/projects/${project}/rounds"`)
    expect(roundsLinksOf(tree, project)).toHaveLength(1)
  })

  async function phaseSeriesScene(admin: string): Promise<string> {
    const project = await newProject(admin, PHASE_3)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    const codebook = new Map<number, string>()
    for (const versionNumber of [1, 2, 3]) {
      codebook.set(
        versionNumber,
        await addCodebookVersion(ownerDb, project, admin, { versionNumber }),
      )
    }
    const scene = [
      { roundNumber: 1, version: 1, phase: PHASE_2, status: 'closed' },
      { roundNumber: 2, version: 2, phase: PHASE_2, status: 'closed' },
      { roundNumber: 3, version: 2, phase: PHASE_3, status: 'closed' },
      { roundNumber: 4, version: 3, phase: PHASE_3, status: 'open' },
    ] as const
    for (const round of scene) {
      await addRound(ownerDb, project, admin, codebook.get(round.version)!, promptVersion, {
        roundNumber: round.roundNumber,
        status: round.status,
        phase: round.phase,
      })
    }
    return project
  }

  function markupText(markup: string): string {
    return markup
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function phaseDividers(markup: string): number {
    return [...markup.matchAll(/<line x1="([^"]+)" x2="\1" y1="0"/g)].length
  }

  function phaseLabels(markup: string): string {
    return markupText(markup.slice(0, markup.indexOf('<h3')))
  }

  it('cada card da série diz a fase ao lado da versão de codebook', async () => {
    const admin = await newUser('Admin')
    const project = await phaseSeriesScene(admin)

    auth.userId = admin
    const tree = await render(project)

    expect(seriesOf(tree).points.map((point) => point.phase)).toEqual([2, 2, 3, 3])

    const text = seriesTextOf(tree)
    expect(text).toContain('Codebook v1 · Fase 2')
    expect(text).toContain('Codebook v2 · Fase 2')
    expect(text).toContain('Codebook v2 · Fase 3')
    expect(text).toContain('Codebook v3 · Fase 3')
    expect(text).toContain('a versão de codebook e a fase indicadas ao lado dele')

    const help = (sectionWith(tree, AgreementSeriesChart)!.props as { help: string }).help
    expect(help).toContain('As Fases 2, 3 e 4 ficam na mesma série')
    expect(help).toContain('a LLM passar a receber o codebook')
  })

  it('as rodadas de cada fase ficam agrupadas, na ordem cronológica, sob o subtítulo da fase', async () => {
    const admin = await newUser('Admin')
    const project = await phaseSeriesScene(admin)

    auth.userId = admin
    const markup = seriesMarkupOf(await render(project))

    const groups = markup.split('<h3').slice(1)
    expect(groups).toHaveLength(2)

    const [phase2, phase3] = groups.map((group) =>
      markupText(`<h3${group.slice(0, group.indexOf('</ul>'))}`),
    )
    expect(phase2.startsWith('Fase 2')).toBe(true)
    expect(phase2).toContain('Rodada 1')
    expect(phase2).toContain('Rodada 2')
    expect(phase2).not.toContain('Rodada 3')
    expect(phase2).not.toContain('Rodada 4')
    expect(phase3.startsWith('Fase 3')).toBe(true)
    expect(phase3).toContain('Rodada 3')
    expect(phase3).toContain('Rodada 4')
    expect(phase3).not.toContain('Rodada 1')
    expect(phase3).not.toContain('Rodada 2')

    const text = markupText(markup)
    expect(text.indexOf('Rodada 2')).toBeLessThan(text.lastIndexOf('Fase 3 Rodada 3'))
  })

  it('o gráfico separa as fases com uma divisória e rotula cada grupo embaixo das colunas', async () => {
    const admin = await newUser('Admin')
    const project = await phaseSeriesScene(admin)

    auth.userId = admin
    const markup = seriesMarkupOf(await render(project))

    expect(phaseDividers(markup)).toBe(1)
    expect(markup).toContain('<line x1="50" x2="50" y1="0"')
    expect(phaseLabels(markup)).toBe('Fase 2 Fase 3')
  })

  it('a série de uma fase só não tem divisória, e o rótulo diz de que fase ela é', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    for (const roundNumber of [1, 2]) {
      await roundWith(project, admin, promptVersion, { roundNumber, versionNumber: roundNumber })
    }

    auth.userId = admin
    const markup = seriesMarkupOf(await render(project))

    expect(phaseDividers(markup)).toBe(0)
    expect(phaseLabels(markup)).toBe('Fase 2')
    expect(markup.split('<h3')).toHaveLength(2)
  })

  it('agrupar por fase não junta rodadas: um card por rodada e nenhum valor por fase', async () => {
    const admin = await newUser('Admin')
    const project = await phaseSeriesScene(admin)

    auth.userId = admin
    const tree = await render(project)
    const markup = seriesMarkupOf(tree)

    expect(seriesOf(tree).points).toHaveLength(4)

    const text = markupText(markup)
    expect(text.match(/Rodada \d/g)).toEqual(['Rodada 1', 'Rodada 2', 'Rodada 3', 'Rodada 4'])
    expect(text).not.toContain('média')
    expect(text).not.toContain('total')
    expect(text.match(new RegExp(NOT_CALCULABLE_LABEL, 'g'))).toHaveLength(4)
  })

  async function phase4SeriesScene(admin: string) {
    const project = await newProject(admin, PHASE_4)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    const codebookV1 = await addCodebookVersion(ownerDb, project, admin, { versionNumber: 1 })
    const codebookV2 = await addCodebookVersion(ownerDb, project, admin, { versionNumber: 2 })
    const scene = [
      { roundNumber: 1, codebook: codebookV1, phase: PHASE_2, status: 'closed' },
      { roundNumber: 2, codebook: codebookV2, phase: PHASE_3, status: 'closed' },
      { roundNumber: 3, codebook: codebookV2, phase: PHASE_3, status: 'closed' },
      { roundNumber: 4, codebook: codebookV2, phase: PHASE_4, status: 'open' },
    ] as const
    for (const round of scene) {
      await addRound(ownerDb, project, admin, round.codebook, promptVersion, {
        roundNumber: round.roundNumber,
        status: round.status,
        phase: round.phase,
      })
    }
    return project
  }

  it('a série de Concordância põe a rodada da Fase 4 num grupo próprio, depois das Fases 2 e 3', async () => {
    const admin = await newUser('Admin')
    const project = await phase4SeriesScene(admin)

    auth.userId = admin
    const tree = await render(project)
    const points = seriesOf(tree).points

    expect(points.map((point) => point.roundNumber)).toEqual([1, 2, 3, 4])
    expect(phaseRuns(points).map((run) => run.phase)).toEqual([PHASE_2, PHASE_3, PHASE_4])

    const markup = seriesMarkupOf(tree)
    expect(phaseDividers(markup)).toBe(2)
    expect(phaseLabels(markup)).toBe('Fase 2 Fase 3 Fase 4')

    const groups = markup.split('<h3').slice(1)
    expect(groups).toHaveLength(3)
    const phase4 = markupText(`<h3${groups[2].slice(0, groups[2].indexOf('</ul>'))}`)
    expect(phase4.startsWith('Fase 4')).toBe(true)
    expect(phase4).toContain('Rodada 4')
    expect(phase4).not.toContain('Rodada 3')
  })

  it('o texto de ajuda da série de Concordância explica a Fase 4', async () => {
    const admin = await newUser('Admin')
    const project = await phase4SeriesScene(admin)

    auth.userId = admin
    const tree = await render(project)

    const help = (sectionWith(tree, AgreementSeriesChart)!.props as { help: string }).help
    expect(help).toContain('As Fases 2, 3 e 4 ficam na mesma série')
    expect(help).toContain('Na Fase 4, codebook e prompt não mudam')
    expect(help).toContain('ao lado da sua rodada de referência')
  })

  it('a série de Qualidade cobre as Fases 3 e 4, com a fase de cada ponto e um grupo por fase', async () => {
    const admin = await newUser('Admin')
    const project = await phase4SeriesScene(admin)

    auth.userId = admin
    const tree = await render(project)

    const points = qualitySeriesOf(tree).points
    expect(points.map((point) => point.roundNumber)).toEqual([2, 3, 4])
    expect(points.map((point) => point.phase)).toEqual([PHASE_3, PHASE_3, PHASE_4])

    const markup = renderToStaticMarkup(createElement(QualitySeriesList, qualitySeriesOf(tree)))
    const groups = markup.split('<h3').slice(1)
    expect(groups).toHaveLength(2)

    const [phase3, phase4] = groups.map((group) =>
      markupText(`<h3${group.slice(0, group.indexOf('</ul>'))}`),
    )
    expect(phase3.startsWith('Fase 3')).toBe(true)
    expect(phase3).toContain('Rodada 2')
    expect(phase3).toContain('Rodada 3')
    expect(phase3).not.toContain('Rodada 4')
    expect(phase4.startsWith('Fase 4')).toBe(true)
    expect(phase4).toContain('Rodada 4')
    expect(phase4).not.toContain('Rodada 3')

    const { bars, numbers } = qualitySeriesPartsOf(tree)
    const numbersText = markupText(numbers)
    expect(numbersText).toContain('Prompt v1 · Fase 3')
    expect(numbersText).toContain('Prompt v1 · Fase 4')
    expect(markupText(markup)).not.toContain('Rodada 1')
    expect(markupText(bars).match(/Rodada \d/g)).toEqual(['Rodada 2', 'Rodada 3', 'Rodada 4'])
    expect(numbersText.match(/Rodada \d/g)).toEqual(['Rodada 2', 'Rodada 3', 'Rodada 4'])
  })

  it('os textos da série de Qualidade falam das Fases 3 e 4, e não só da Fase 3', async () => {
    expect(QUALITY_SERIES_HINT).toContain(`Fases ${PHASE_3} e ${PHASE_4}`)
    expect(QUALITY_SERIES_HELP).toContain(`da Fase ${PHASE_3} ou da Fase ${PHASE_4}`)
    expect(QUALITY_SERIES_HELP).toContain(`Fase ${PHASE_2} não entram`)
    expect(QUALITY_SERIES_HELP).toContain('ao lado da sua rodada de referência')

    const admin = await newUser('Admin')
    const project = await phase4SeriesScene(admin)

    auth.userId = admin
    const section = sectionWith(await render(project), QualitySeriesList)
    const props = section!.props as { hint: string; help: string }
    expect(props.hint).toBe(QUALITY_SERIES_HINT)
    expect(props.help).toBe(QUALITY_SERIES_HELP)
  })

  it('o Avaliador não vê as séries num projeto com rodada da Fase 4', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await phase4SeriesScene(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = admin
    const adminTree = await render(project)
    expect(seriesOf(adminTree).points).toHaveLength(4)
    expect(qualitySeriesOf(adminTree).points).toHaveLength(3)

    auth.userId = evaluator
    const tree = await render(project)
    expect(findElement(tree, AgreementSeriesChart)).toBeNull()
    expect(findElement(tree, QualitySeriesList)).toBeNull()
    const page = deepText(tree)
    expect(page).not.toContain('Concordância')
    expect(page).not.toContain('Qualidade')
    expect(page).not.toContain('rodada de referência')
  })

  it('a visão geral resume codebook, prompt e itens com link para cada tela', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category' },
        { title: 'Transacional', type: 'category' },
      ],
    })
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin)

    auth.userId = admin
    const tree = await render(project)

    for (const route of ['codebook', 'prompt', 'items']) {
      expect(hasProp(tree, 'href', `/projects/${project}/${route}`)).toBe(true)
    }
  })

  it('as abas por artefato e Ajustes são do Administrador; Membros é de quem participa ativamente', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    const adminTabs = await tabsOf(project, admin)
    const evaluatorTabs = await tabsOf(project, evaluator)

    for (const route of ['codebook', 'prompt', 'items']) {
      const href = `/projects/${project}/${route}`
      expect(hasProp(adminTabs, 'href', href)).toBe(true)
      expect(hasProp(evaluatorTabs, 'href', href)).toBe(false)
    }

    const settings = `/projects/${project}/settings`
    expect(hasProp(adminTabs, 'href', settings)).toBe(true)
    expect(hasProp(evaluatorTabs, 'href', settings)).toBe(false)

    const members = `/projects/${project}/members`
    for (const tabs of [adminTabs, evaluatorTabs]) {
      expect(hasProp(tabs, 'href', members)).toBe(true)
      expect(hasProp(tabs, 'href', `/projects/${project}/pipeline`)).toBe(false)
    }
  })

  it('quem ainda está em onboarding não tem a aba Membros nem a aba Ajustes', async () => {
    const admin = await newUser('Admin')
    const invited = await newUser('Convidado')
    const project = await newProject(admin)
    await addPendingMember(ownerDb, project, invited)

    const tabs = await tabsOf(project, invited)
    expect(hasProp(tabs, 'href', `/projects/${project}/members`)).toBe(false)
    expect(hasProp(tabs, 'href', `/projects/${project}/settings`)).toBe(false)
  })

  it('a aba Rodadas é link para o Administrador e para o Avaliador, e só para eles', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const invited = await newUser('Convidado')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    await addPendingMember(ownerDb, project, invited)

    const href = `/projects/${project}/rounds`
    expect(hasProp(await tabsOf(project, admin), 'href', href)).toBe(true)
    expect(hasProp(await tabsOf(project, evaluator), 'href', href)).toBe(true)
    expect(hasProp(await tabsOf(project, invited), 'href', href)).toBe(false)
  })
})
