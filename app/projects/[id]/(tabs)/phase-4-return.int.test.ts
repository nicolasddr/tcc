import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Fragment, createElement, isValidElement, type ReactElement } from 'react'
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
  usePathname: () => '/',
}))

import ProjectPage from '@/app/projects/[id]/(tabs)/page'
import { Phase4Return } from '@/app/projects/[id]/pipeline/phase-4-return'
import { ReturnPhase } from '@/app/projects/[id]/pipeline/return-phase'
import { Phase3Checklist } from '@/app/projects/[id]/pipeline/phase-3-checklist'
import { AdvancePhase } from '@/app/projects/[id]/pipeline/advance-phase'
import { returnToPhase3 } from '@/app/projects/[id]/pipeline/actions'
import {
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
  returnBlockerMessage,
  returnConfirmationLines,
} from '@/app/projects/[id]/pipeline/preconditions'
import { ReferenceComparisonPanel } from '@/app/projects/[id]/(tabs)/rounds/reference-comparison-panel'
import { AgreementValue } from '@/app/projects/[id]/(tabs)/rounds/agreement-panel'
import { QualityValue } from '@/app/projects/[id]/(tabs)/rounds/quality-panel'
import { AgreementSeriesChart } from '@/app/projects/[id]/(tabs)/rounds/agreement-series-chart'
import { phaseRuns } from '@/app/projects/[id]/(tabs)/rounds/agreement-series'
import { bandLabel } from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { Button, ButtonLink } from '@/app/components/ui/button'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
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
  type CellFixture,
  cleanup,
} from '@/test/helpers'

function findAll(node: unknown, type: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type))
  if (!isValidElement(node)) return []
  const own = node.type === type ? [node] : []
  return [
    ...own,
    ...Object.values(node.props as Record<string, unknown>).flatMap((value) =>
      findAll(value, type),
    ),
  ]
}

function findElement(node: unknown, type: unknown): ReactElement | null {
  return findAll(node, type)[0] ?? null
}

function hasProp(node: unknown, key: string, value: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => hasProp(child, key, value))
  if (!isValidElement(node)) return false
  const props = node.props as Record<string, unknown>
  if (props[key] === value) return true
  return Object.values(props).some((child) => hasProp(child, key, value))
}

function markupText(element: ReactElement): string {
  return renderToStaticMarkup(element)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type PanelProps = Parameters<typeof Phase4Return>[0]
type ReturnProps = Parameters<typeof ReturnPhase>[0]
type ComparisonProps = Parameters<typeof ReferenceComparisonPanel>[0]
type Phase3Props = Parameters<typeof Phase3Checklist>[0]
type AdvanceProps = Parameters<typeof AdvancePhase>[0]
type SeriesProps = Parameters<typeof AgreementSeriesChart>[0]
type LinkProps = Parameters<typeof ButtonLink>[0]

type ScaleValue = NonNullable<CellFixture['value']>

function render(id: string) {
  return ProjectPage({ params: Promise.resolve({ id }) })
}

function panelOf(tree: unknown): PanelProps | null {
  const element = findElement(tree, Phase4Return)
  return element ? (element.props as PanelProps) : null
}

function returnOf(tree: unknown): ReturnProps {
  const props = panelOf(tree)
  expect(props).toBeTruthy()
  const element = findElement(Phase4Return(props!), ReturnPhase)
  expect(element).toBeTruthy()
  return element!.props as ReturnProps
}

function panelTextOf(tree: unknown): string {
  const props = panelOf(tree)
  expect(props).toBeTruthy()
  return markupText(createElement(Phase4Return, props!))
}

function comparisonOf(summary: unknown): ComparisonProps {
  const element = findElement(summary, ReferenceComparisonPanel)
  expect(element).toBeTruthy()
  return element!.props as ComparisonProps
}

const FORBIDDEN = ['conclu', 'aprova', 'replic', 'generaliz', 'próxima etapa', 'tudo pronto']

const NOTES = {
  ana: ['high', 'high', 'high', 'medium'],
  bruno: ['high', 'high', 'medium', 'low'],
} as const

describe('app/projects/[id]/page — painel para voltar da Fase 4 para a Fase 3', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function newProject(admin: string, phase: number): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
    projs.push(id)
    return id
  }

  async function roundWith(
    project: string,
    admin: string,
    promptVersion: string,
    opts: {
      roundNumber: number
      versionNumber: number
      phase: number
      status?: 'open' | 'closed'
      byEvaluator?: Record<string, readonly ScaleValue[]>
    },
  ): Promise<string> {
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: opts.versionNumber,
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
      ],
    })
    const round = await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: opts.roundNumber,
      status: opts.status ?? 'closed',
      phase: opts.phase,
    })

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

  async function phase4Scene(
    admin: string,
    phase4Rounds: { roundNumber: number; status?: 'open' | 'closed' }[] = [],
  ) {
    const project = await newProject(admin, PHASE_4)
    const evaluator = await newUser('Ana')
    const ana = await addActiveEvaluator(ownerDb, project, evaluator)
    const bruno = await addActiveEvaluator(ownerDb, project, await newUser('Bruno'))
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    const byEvaluator = { [ana]: NOTES.ana, [bruno]: NOTES.bruno }

    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      phase: PHASE_2,
    })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      phase: PHASE_3,
      byEvaluator,
    })
    for (const round of phase4Rounds) {
      await roundWith(project, admin, promptVersion, {
        roundNumber: round.roundNumber,
        versionNumber: round.roundNumber,
        phase: PHASE_4,
        status: round.status,
        byEvaluator: round.status === 'open' ? undefined : byEvaluator,
      })
    }

    return { project, evaluator, promptVersion }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('na Fase 4 sem rodada aberta, o painel aparece liberado com as linhas da confirmação', async () => {
    const admin = await newUser('Admin')
    const { project } = await phase4Scene(admin)

    auth.userId = admin
    const tree = await render(project)

    expect(panelOf(tree)!.inputs).toEqual({ openRoundNumber: null })
    const props = returnOf(tree)
    expect(props.blocked).toBe(false)
    expect(props.lines).toEqual(returnConfirmationLines())

    const text = panelTextOf(tree)
    expect(text).toContain('Para voltar à Fase 3')
    expect(text).toContain('liberado')
    expect(text).toContain('Nenhuma rodada aberta')
    expect(text).toContain('pronto')
    expect(text).toContain('Voltar à Fase 3')
  })

  it('a rodada aberta da Fase 4 trava o retorno, e o painel a nomeia e leva às rodadas', async () => {
    const admin = await newUser('Admin')
    const { project } = await phase4Scene(admin, [{ roundNumber: 3, status: 'open' }])

    auth.userId = admin
    const tree = await render(project)

    expect(panelOf(tree)!.inputs).toEqual({ openRoundNumber: 3 })
    expect(returnOf(tree).blocked).toBe(true)

    const text = panelTextOf(tree)
    expect(text).toContain(returnBlockerMessage({ key: 'open_round', roundNumber: 3 }))
    expect(text).toContain('rodada 3')
    expect(text).toContain('1 pendência')
    expect(text).toContain('Resolver')
    expect(hasProp(Phase4Return(panelOf(tree)!), 'href', `/projects/${project}/rounds`)).toBe(
      true,
    )
  })

  it('sem rodada fechada da Fase 4, a confirmação não mostra comparação', async () => {
    const admin = await newUser('Admin')
    const { project } = await phase4Scene(admin)

    auth.userId = admin
    const props = returnOf(await render(project))
    expect(props.summary ?? null).toBeNull()
  })

  it('com rodadas fechadas da Fase 4, a confirmação mostra a última delas ao lado da sua referência, sem veredito', async () => {
    const admin = await newUser('Admin')
    const { project } = await phase4Scene(admin, [{ roundNumber: 3 }, { roundNumber: 4 }])

    auth.userId = admin
    const summary = returnOf(await render(project)).summary
    expect(summary).toBeTruthy()

    const comparison = comparisonOf(summary)
    expect(comparison.roundNumber).toBe(4)
    if (comparison.comparison.kind !== 'compared') throw new Error('deveria comparar')
    expect(comparison.comparison.round.roundNumber).toBe(4)
    expect(comparison.comparison.reference.roundNumber).toBe(2)
    expect(comparison.comparison.round.quality).not.toBeNull()
    expect(comparison.comparison.reference.quality).not.toBeNull()

    const rendered = ReferenceComparisonPanel(comparison)
    const agreement = findAll(rendered, AgreementValue)
    expect(agreement).toHaveLength(2)
    for (const side of agreement) {
      expect((side.props as Parameters<typeof AgreementValue>[0]).band).toBe(false)
    }
    expect(findAll(rendered, QualityValue)).toHaveLength(2)

    const text = markupText(createElement(Fragment, null, summary))
    expect(text).toContain('Última rodada fechada da Fase 4')
    expect(text).toContain('Rodada 4')
    expect(text).toContain('Rodada 2')
    for (const band of ['questionable', 'acceptable', 'good'] as const) {
      expect(text).not.toContain(bandLabel(band))
    }
    expect(text.toLowerCase()).not.toContain('diferença')
  })

  it('a rodada da Fase 4 de uma passagem anterior não entra na confirmação', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_4)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      phase: PHASE_3,
    })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 3,
      versionNumber: 3,
      phase: PHASE_4,
    })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 4,
      versionNumber: 4,
      phase: PHASE_3,
    })

    auth.userId = admin
    expect(returnOf(await render(project)).summary ?? null).toBeNull()
  })

  it('o painel da Fase 4 não tem botão de concluir nem texto de aprovação', async () => {
    const admin = await newUser('Admin')
    const { project } = await phase4Scene(admin, [{ roundNumber: 3 }])

    auth.userId = admin
    const tree = await render(project)

    const text = panelTextOf(tree).toLowerCase()
    for (const word of FORBIDDEN) expect(text).not.toContain(word)

    const rendered = Phase4Return(panelOf(tree)!)
    expect(findAll(rendered, ReturnPhase)).toHaveLength(1)
    expect(findAll(rendered, Button)).toHaveLength(0)
    expect(findAll(rendered, ButtonLink)).toHaveLength(0)
  })

  it('o painel só existe na Fase 4', async () => {
    const admin = await newUser('Admin')

    for (const phase of [PHASE_2, PHASE_3]) {
      const project = await newProject(admin, phase)
      auth.userId = admin
      expect(panelOf(await render(project))).toBeNull()
    }
  })

  it('na Fase 4 a barra leva a #voltar com um link secundário; nas Fases 1 a 3 continua levando a #avancar', async () => {
    const admin = await newUser('Admin')
    auth.userId = admin

    for (const phase of [PHASE_1, PHASE_2, PHASE_3]) {
      const tree = await render(await newProject(admin, phase))
      expect(hasProp(tree, 'href', '#avancar')).toBe(true)
      expect(hasProp(tree, 'href', '#voltar')).toBe(false)
    }

    const tree = await render(await newProject(admin, PHASE_4))
    expect(hasProp(tree, 'href', '#avancar')).toBe(false)
    const link = findAll(tree, ButtonLink).find(
      (element) => (element.props as LinkProps).href === '#voltar',
    )
    expect(link).toBeTruthy()
    expect((link!.props as LinkProps).variant).toBe('secondary')
    expect(markupText(link!)).toBe('Voltar à Fase 3')
  })

  it('o Avaliador não vê o painel nem o link da barra, com e sem rodada fechada da Fase 4', async () => {
    const admin = await newUser('Admin')

    for (const phase4Rounds of [[], [{ roundNumber: 3 }]]) {
      const { project, evaluator } = await phase4Scene(admin, phase4Rounds)

      auth.userId = evaluator
      const tree = await render(project)
      expect(panelOf(tree)).toBeNull()
      expect(findElement(tree, ReturnPhase)).toBeNull()
      expect(hasProp(tree, 'href', '#voltar')).toBe(false)
    }
  })

  it('na Fase 3, a confirmação do avanço para a Fase 4 diz que é possível voltar à Fase 3', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_3)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, {
      roundNumber: 1,
      versionNumber: 1,
      phase: PHASE_3,
    })

    auth.userId = admin
    const checklist = findElement(await render(project), Phase3Checklist)
    expect(checklist).toBeTruthy()
    const advance = findElement(Phase3Checklist(checklist!.props as Phase3Props), AdvancePhase)
    expect(advance).toBeTruthy()
    expect((advance!.props as AdvanceProps).lines.join(' ')).toContain('voltar à Fase 3')
  })

  it('depois do retorno, a série de Concordância mostra as Fases 3, 4 e 3, nessa ordem', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_4)
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await roundWith(project, admin, promptVersion, {
      roundNumber: 2,
      versionNumber: 2,
      phase: PHASE_3,
    })
    await roundWith(project, admin, promptVersion, {
      roundNumber: 3,
      versionNumber: 3,
      phase: PHASE_4,
    })

    auth.userId = admin
    const form = new FormData()
    form.set('project_id', project)
    expect(await returnToPhase3(null, form)).toMatchObject({ ok: true, phase: PHASE_3 })

    await roundWith(project, admin, promptVersion, {
      roundNumber: 4,
      versionNumber: 4,
      phase: PHASE_3,
    })

    const tree = await render(project)
    const series = findElement(tree, AgreementSeriesChart)
    expect(series).toBeTruthy()
    const points = (series!.props as SeriesProps).points
    expect(points.map((point) => point.roundNumber)).toEqual([2, 3, 4])
    expect(phaseRuns(points).map((run) => run.phase)).toEqual([PHASE_3, PHASE_4, PHASE_3])
    expect(panelOf(tree)).toBeNull()
  })
})
