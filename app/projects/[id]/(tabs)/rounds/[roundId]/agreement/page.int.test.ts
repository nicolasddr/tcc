import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isValidElement, type ReactElement } from 'react'
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

import RoundAgreementPage from '@/app/projects/[id]/(tabs)/rounds/[roundId]/agreement/page'
import ProjectRoundsPage from '@/app/projects/[id]/(tabs)/rounds/page'
import { AgreementNotes } from '@/app/projects/[id]/(tabs)/rounds/agreement-panel'
import { CriterionAgreementTable } from '@/app/projects/[id]/(tabs)/rounds/criterion-agreement-table'
import { loadRoundObservations } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import {
  AGREEMENT_SECTION_ID,
  agreementCriterionHref,
} from '@/app/projects/[id]/(tabs)/rounds/reading-shortcuts'
import { AgreementMatrixTable } from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix-table'
import { CriterionByDefinitionTable } from '@/app/projects/[id]/(tabs)/rounds/criterion-by-definition-table'
import { Tab } from '@/app/components/ui/tabs'
import { Section } from '@/app/components/ui/section'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'
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

function agreementSectionOf(tree: unknown): ReactElement {
  const sections = findAll(tree, Section).filter(
    (section) => (section.props as { id?: string }).id === AGREEMENT_SECTION_ID,
  )
  expect(sections).toHaveLength(1)
  return sections[0]
}

function titleOf(section: ReactElement): unknown {
  return (section.props as { title: unknown }).title
}

function render(id: string, roundId: string, query: { criterio?: string } = {}) {
  return RoundAgreementPage({
    params: Promise.resolve({ id, roundId }),
    searchParams: Promise.resolve(query),
  })
}

function renderRounds(id: string) {
  return ProjectRoundsPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  })
}

type Scene = {
  project: string
  admin: string
  evaluators: string[]
  rounds: string[]
}

describe('app/projects/[id]/rounds/[roundId]/agreement — a concordância de uma rodada', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function scene(): Promise<Scene> {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: PHASE_3,
    })
    projs.push(project)

    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 1,
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Precisão' }] },
      ],
      generalCriteria: [{ name: 'Clareza' }],
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 1,
    })
    const codebook = await loadCodebookVersion(project, codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria)

    const evaluators = [
      await addActiveEvaluator(ownerDb, project, await newUser('Bruna')),
      await addActiveEvaluator(ownerDb, project, await newUser('Caio')),
      await addActiveEvaluator(ownerDb, project, await newUser('Davi')),
    ]

    const values: CellFixture['value'][][] = [
      ['high', 'high', 'low'],
      ['medium', 'low', 'low'],
    ]

    const rounds: string[] = []
    for (const [index, roundValues] of values.entries()) {
      const round = await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
        roundNumber: index + 1,
        status: 'closed',
        phase: PHASE_3,
      })
      rounds.push(round)

      for (let item = 0; item < index + 2; item += 1) {
        const input = await addInputItem(ownerDb, project, admin, {
          name: `Item ${index + 1}.${item + 1}`,
        })
        const response = await addResponse(ownerDb, round, input, admin)
        for (const [position, member] of evaluators.entries()) {
          await addEvaluation(ownerDb, round, response, member, {
            cells: cells.map((cell) => ({
              definitionId: cell.definition?.id ?? null,
              criterionId: cell.criterion.id,
              value: roundValues[position],
            })),
          })
        }
      }
    }

    await addOutlier(ownerDb, rounds[1], evaluators[0], admin)

    return { project, admin, evaluators, rounds }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('a rodada em foco aparece igual na tela de rodadas e na página dela', async () => {
    const { project, admin, rounds } = await scene()

    auth.userId = admin
    const fromRounds = agreementSectionOf(await renderRounds(project))
    const fromPage = agreementSectionOf(await render(project, rounds[1]))

    expect(titleOf(fromPage)).toBe('Concordância e confiabilidade na rodada 2, fechada')
    expect(
      renderToStaticMarkup(fromPage).replaceAll(
        `/projects/${project}/rounds/${rounds[1]}/agreement`,
        `/projects/${project}/rounds`,
      ),
    ).toBe(renderToStaticMarkup(fromRounds))
  })

  it('as abas por critério levam à própria página, e a aba vem do parâmetro', async () => {
    const { project, admin, rounds } = await scene()
    const href = `/projects/${project}/rounds/${rounds[0]}/agreement`

    auth.userId = admin
    const all = agreementSectionOf(await render(project, rounds[0]))
    const hrefs = findAll(all, Tab).map((tab) => (tab.props as { href: string }).href)
    expect(hrefs).toHaveLength(3)
    expect(hrefs[0]).toBe(agreementCriterionHref(href, null))
    expect(findAll(all, AgreementMatrixTable)).toHaveLength(1)

    const criterion = new URLSearchParams(hrefs[1].split('?')[1].split('#')[0]).get('criterio')!
    const one = agreementSectionOf(await render(project, rounds[0], { criterio: criterion }))
    expect(findAll(one, AgreementMatrixTable)).toHaveLength(0)
    const [table] = findAll(one, CriterionByDefinitionTable)
    expect((table.props as { columnKey: string }).columnKey).toBe(criterion)
    expect(
      findAll(one, Tab).map((tab) => (tab.props as { active?: boolean }).active),
    ).toEqual([false, true, false])

    const unknown = agreementSectionOf(await render(project, rounds[0], { criterio: 'x' }))
    expect(findAll(unknown, AgreementMatrixTable)).toHaveLength(1)
  })

  it('uma rodada anterior mostra as notas dela, não as da rodada em foco', async () => {
    const { project, admin, rounds } = await scene()

    auth.userId = admin
    const section = agreementSectionOf(await render(project, rounds[0]))
    expect(titleOf(section)).toBe('Concordância e confiabilidade na rodada 1, fechada')

    const [notes] = findAll(section, AgreementNotes)
    expect((notes.props as Parameters<typeof AgreementNotes>[0]).outliers).toEqual([])

    const [table] = findAll(section, CriterionAgreementTable)
    const { observations, excluded } = table.props as Parameters<
      typeof CriterionAgreementTable
    >[0]
    expect(excluded).toEqual(new Set())
    expect(observations).toEqual(await loadRoundObservations(rounds[0]))
    expect(observations).not.toEqual(await loadRoundObservations(rounds[1]))
  })

  it('o avaliador não abre a concordância da rodada', async () => {
    const { project, rounds } = await scene()
    const evaluator = await newUser('Eva')
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    await expect(render(project, rounds[0])).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('uma rodada de outro projeto, ou um id que não é rodada, dá não encontrado', async () => {
    const first = await scene()
    const second = await scene()

    auth.userId = first.admin
    await expect(render(first.project, second.rounds[0])).rejects.toThrow('NEXT_NOTFOUND')
    await expect(render(first.project, 'nao-e-uuid')).rejects.toThrow('NEXT_NOTFOUND')
  })
})
