import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Fragment, createElement, isValidElement, type ReactElement } from 'react'
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
import {
  ReviewGroupsList,
  MINUTES_LABEL,
  OUTLIER_NOTE_LABEL,
  PRIVATE_LABEL,
} from '@/app/projects/[id]/(tabs)/rounds/review-groups-list'
import type { ConsensusNote } from '@/app/projects/[id]/(tabs)/rounds/consensus'
import type {
  OutlierNote,
  ReviewNote,
} from '@/app/projects/[id]/(tabs)/rounds/review-groups'
import { consensusCellKey } from '@/app/projects/[id]/(tabs)/rounds/consensus-cells'
import {
  DIVERGENCE_LEGEND,
  NO_JUSTIFICATION_LABEL,
  divergenceLabel,
} from '@/app/projects/[id]/(tabs)/rounds/divergence'
import { AgreementPanel } from '@/app/projects/[id]/(tabs)/rounds/agreement-panel'
import { AgreementMatrixTable } from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix-table'
import { QualityPanel, QualityValue } from '@/app/projects/[id]/(tabs)/rounds/quality-panel'
import { scaleLabel } from '@/app/projects/[id]/(tabs)/evaluate/scale'
import {
  AdminResponseCard,
  SentInput,
  SENT_INPUT_MISSING,
  SENT_INPUT_SUMMARY,
} from '@/app/projects/[id]/(tabs)/rounds/sent-input'
import { QueueNav } from '@/app/components/ui/queue-nav'
import { Disclosure } from '@/app/components/ui/disclosure'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { PHASE_2, PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'
import { roundInputSummary } from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { RoundChangesNote } from '@/app/projects/[id]/(tabs)/rounds/round-changes-note'
import {
  CODEBOOK_AND_PROMPT_NOTICE,
  CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE,
  ENTERS_PHASE_3_NOTE,
} from '@/app/projects/[id]/(tabs)/rounds/round-changes-labels'
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
  addOutlier,
  addConsensusNote,
  memberId,
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

type ChangesProps = Parameters<typeof RoundChangesNote>[0]

function changesTextOf(tree: unknown): string {
  const element = findElement(tree, RoundChangesNote)
  expect(element).toBeTruthy()
  return renderToStaticMarkup(
    createElement(RoundChangesNote, element!.props as ChangesProps),
  )
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
  codebookVersion: string
  promptVersion: string
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

function cellNotesOf(
  tree: unknown,
  definition: string,
  criterion: string,
): ReviewNote[] {
  const group = listOf(tree).groups.find(
    (candidate) => candidate.definition.title === definition,
  )
  expect(group).toBeTruthy()
  const cell = group!.cells.find((candidate) => candidate.criterion.name === criterion)
  expect(cell).toBeTruthy()
  return cell!.notes
}

function markOf(notes: readonly ReviewNote[], evaluatorName: string): OutlierNote {
  const found = notes.find((note) => note.evaluatorName === evaluatorName)
  expect(found).toBeTruthy()
  return { isOutlier: found!.isOutlier, outlierReason: found!.outlierReason }
}

function mineOf(tree: unknown, cell: SceneCell): ConsensusNote | null {
  const context = listOf(tree).consensus
  expect(context).toBeTruthy()
  const key = consensusCellKey(cell.definitionId, cell.criterionId)
  return context!.byCell.get(key)?.mine ?? null
}

type CardProps = Parameters<typeof AdminResponseCard>[0]

function adminCardOf(tree: unknown): CardProps {
  const card = findElement(tree, AdminResponseCard)
  expect(card).toBeTruthy()
  return card!.props as CardProps
}

function sentInputTreeOf(tree: unknown): unknown {
  const inner = findElement(AdminResponseCard(adminCardOf(tree)), SentInput)
  expect(inner).toBeTruthy()
  return SentInput(inner!.props as Parameters<typeof SentInput>[0])
}

function sentInputTextOf(tree: unknown): string {
  const disclosure = findElement(sentInputTreeOf(tree), Disclosure)
  expect(disclosure).toBeTruthy()
  const pre = findElement((disclosure!.props as { children: unknown }).children, 'pre')
  expect(pre).toBeTruthy()
  return (pre!.props as { children: string }).children
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
      phase?: number
      codebookVersion?: string
      promptVersion?: string
      texts?: string[]
      sentInputs?: (string | null)[]
    } = {},
  ): Promise<Scene> {
    const phase = opts.phase ?? PHASE_2
    let project = opts.project
    if (!project) {
      project = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
      projs.push(project)
    }

    const roundNumber = opts.roundNumber ?? 1
    const codebookVersion =
      opts.codebookVersion ??
      (await addCodebookVersion(ownerDb, project, admin, {
        versionNumber: roundNumber,
        ...(opts.shape ?? TWO_DEFINITIONS),
      }))
    const promptVersion =
      opts.promptVersion ??
      (await addPromptVersion(ownerDb, project, admin, {
        versionNumber: roundNumber,
      }))
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber, status: opts.status ?? 'closed', phase },
    )

    const responses: string[] = []
    for (let index = 0; index < responseCount; index += 1) {
      const item = await addInputItem(ownerDb, project, admin, {
        name: `Item ${index + 1}`,
      })
      responses.push(
        await addResponse(ownerDb, round, item, admin, {
          text: opts.texts?.[index],
          sentInput: opts.sentInputs?.[index],
        }),
      )
    }

    const codebook = await loadCodebookVersion(project, codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria).map((cell) => ({
      definitionId: cell.definition.id,
      criterionId: cell.criterion.id,
      definitionTitle: cell.definition.title,
      criterionName: cell.criterion.name,
    }))

    return { project, codebookVersion, promptVersion, round, responses, cells }
  }

  async function nextRoundWith(
    admin: string,
    previous: Scene,
    responseCount: number,
    opts: {
      roundNumber: number
      newCodebook?: boolean
      newPrompt?: boolean
      phase?: number
      status?: 'open' | 'closed'
    },
  ): Promise<Scene> {
    return roundWith(admin, responseCount, {
      project: previous.project,
      roundNumber: opts.roundNumber,
      phase: opts.phase,
      status: opts.status,
      codebookVersion: opts.newCodebook ? undefined : previous.codebookVersion,
      promptVersion: opts.newPrompt ? undefined : previous.promptVersion,
    })
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

  async function consensus(
    scene: Scene,
    member: string,
    visibility: 'shared' | 'private',
    response: number,
    definition: string,
    criterion: string,
    text: string,
  ): Promise<void> {
    const { definitionId, criterionId } = cellOf(scene, definition, criterion)
    await addConsensusNote(ownerDb, {
      roundId: scene.round,
      responseId: scene.responses[response],
      definitionId,
      criterionId,
      projectMemberId: member,
      visibility,
      text,
    })
  }

  async function minutes(
    scene: Scene,
    author: string,
    response: number,
    definition: string,
    criterion: string,
    text: string,
  ): Promise<void> {
    const member = await memberId(ownerDb, scene.project, author)
    await consensus(scene, member, 'shared', response, definition, criterion, text)
  }

  async function draft(
    scene: Scene,
    member: string,
    response: number,
    definition: string,
    criterion: string,
    text: string,
  ): Promise<void> {
    await consensus(scene, member, 'private', response, definition, criterion, text)
  }

  async function newSignedEvaluator(
    project: string,
    name: string,
  ): Promise<{ user: string; member: string }> {
    const user = await newUser(name)
    return { user, member: await addActiveEvaluator(ownerDb, project, user) }
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

  it('para o Administrador, a nota de quem está marcado vem identificada e com a justificativa', async () => {
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
    await addOutlier(ownerDb, scene.round, bruno, admin, {
      reason: 'Notou o oposto do grupo em todas as respostas e não justificou nenhuma.',
    })

    auth.userId = admin
    const tree = await render(scene.project, scene.round)
    const notes = cellNotesOf(tree, 'Informacional', 'Precisão')

    expect(markOf(notes, 'Bruno Avaliador')).toEqual({
      isOutlier: true,
      outlierReason:
        'Notou o oposto do grupo em todas as respostas e não justificou nenhuma.',
    })
    expect(markOf(notes, 'Ana Avaliadora')).toEqual({
      isOutlier: false,
      outlierReason: null,
    })
    expect(listTextOf(tree)).toContain(OUTLIER_NOTE_LABEL)
  })

  it('o avaliador não vê marca nenhuma na mesma rodada, com o mesmo dado no banco', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(scene.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana.member, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: [note(scene, 'Informacional', 'Precisão', 'low')],
    })
    await addOutlier(ownerDb, scene.round, bruno, admin, {
      reason: 'Notou o oposto do grupo em todas as respostas e não justificou nenhuma.',
    })

    auth.userId = ana.user
    const tree = await render(scene.project, scene.round)
    const notes = cellNotesOf(tree, 'Informacional', 'Precisão')

    expect(notes.map((cell) => cell.isOutlier)).toEqual([false, false])
    expect(notes.map((cell) => cell.outlierReason)).toEqual([null, null])

    const text = listTextOf(tree)
    expect(text).not.toContain(OUTLIER_NOTE_LABEL)
    expect(text).not.toContain('Notou o oposto do grupo')
  })

  it('a nota do marcado continua na célula, com valor, justificativa e divergência, para os dois', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(scene.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana.member, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: [
        note(scene, 'Informacional', 'Precisão', 'low', 'A resposta inventa o número.'),
      ],
    })
    await addOutlier(ownerDb, scene.round, bruno, admin)

    for (const viewer of [admin, ana.user]) {
      auth.userId = viewer
      const tree = await render(scene.project, scene.round)
      const notes = cellNotesOf(tree, 'Informacional', 'Precisão')

      expect(notes.map((cell) => cell.evaluatorName)).toEqual([
        'Ana Avaliadora',
        'Bruno Avaliador',
      ])
      expect(notes.map((cell) => cell.value)).toEqual(['high', 'low'])

      const text = listTextOf(tree)
      expect(text).toContain('A resposta inventa o número.')
      expect(text).toContain(divergenceLabel('extreme'))
    }
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

  it('o Administrador lê o que a rodada mandou à LLM, pela fase da rodada', async () => {
    const admin = await newUser('Admin')
    const first = await roundWith(admin, 1, { phase: PHASE_2 })
    const second = await roundWith(admin, 1, { phase: PHASE_3 })

    auth.userId = admin
    const phase2 = textOf(await render(first.project, first.round))
    expect(phase2).toContain(roundInputSummary(PHASE_2))
    expect(phase2).not.toContain(roundInputSummary(PHASE_3))

    const phase3 = textOf(await render(second.project, second.round))
    expect(phase3).toContain(roundInputSummary(PHASE_3))
    expect(phase3).not.toContain(roundInputSummary(PHASE_2))
  })

  it('o avaliador na mesma rodada não lê a fase nem o que foi à LLM', async () => {
    const admin = await newUser('Admin')
    const first = await roundWith(admin, 1, { phase: PHASE_2 })
    const scene = await nextRoundWith(admin, first, 1, {
      roundNumber: 2,
      phase: PHASE_3,
      newCodebook: true,
      newPrompt: true,
    })
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')
    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana.member, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })

    auth.userId = admin
    const adminTree = await render(scene.project, scene.round)
    expect(findElement(adminTree, RoundChangesNote)).toBeTruthy()

    auth.userId = ana.user
    const tree = await render(scene.project, scene.round)
    const text = `${textOf(tree)} ${listTextOf(tree)}`

    expect(text).toContain('Ana Avaliadora')
    expect(text).not.toContain('Fase')
    expect(text).not.toContain('LLM')
    expect(findElement(tree, RoundChangesNote)).toBeNull()
    expect(text).not.toContain('Em relação à rodada')
    expect(text).not.toContain(CODEBOOK_AND_PROMPT_NOTICE)
    expect(text).not.toContain(CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE)
    expect(text).not.toContain(ENTERS_PHASE_3_NOTE)
  })

  it('com codebook e prompt mudados juntos, o Administrador lê o aviso e as três linhas', async () => {
    const admin = await newUser('Admin')
    const first = await roundWith(admin, 1)
    const second = await nextRoundWith(admin, first, 1, {
      roundNumber: 2,
      newCodebook: true,
      newPrompt: true,
    })

    auth.userId = admin
    const text = changesTextOf(await render(second.project, second.round))

    expect(text).toContain('Em relação à rodada 1')
    expect(text).toContain('Codebook: v1 → v2')
    expect(text).toContain('Prompt: v1 → v2')
    expect(text).toContain(`Fase: ${PHASE_2}, a mesma`)
    expect(text).toContain(CODEBOOK_AND_PROMPT_NOTICE)
    expect(text).not.toContain(ENTERS_PHASE_3_NOTE)
  })

  it('com só o codebook mudado, não há aviso, e prompt e fase aparecem como os mesmos', async () => {
    const admin = await newUser('Admin')
    const first = await roundWith(admin, 1)
    const second = await nextRoundWith(admin, first, 1, {
      roundNumber: 2,
      newCodebook: true,
    })

    auth.userId = admin
    const text = changesTextOf(await render(second.project, second.round))

    expect(text).toContain('Codebook: v1 → v2')
    expect(text).toContain('Prompt: v1, o mesmo')
    expect(text).toContain(`Fase: ${PHASE_2}, a mesma`)
    expect(text).not.toContain(CODEBOOK_AND_PROMPT_NOTICE)
    expect(text).not.toContain(CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE)
    expect(text).not.toContain(ENTERS_PHASE_3_NOTE)
  })

  it('na primeira rodada da Fase 3, com as mesmas versões, aparece a frase da forma de montar a entrada', async () => {
    const admin = await newUser('Admin')
    const first = await roundWith(admin, 1, { phase: PHASE_2 })
    const second = await nextRoundWith(admin, first, 1, {
      roundNumber: 2,
      phase: PHASE_3,
    })

    auth.userId = admin
    const text = changesTextOf(await render(second.project, second.round))

    expect(text).toContain(`Fase: ${PHASE_2} → ${PHASE_3}`)
    expect(text).toContain('Codebook: v1, o mesmo')
    expect(text).toContain('Prompt: v1, o mesmo')
    expect(text).toContain(ENTERS_PHASE_3_NOTE)
    expect(text).not.toContain(CODEBOOK_AND_PROMPT_NOTICE)
    expect(text).not.toContain(CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE)
  })

  it('na primeira rodada da Fase 3 com o codebook também mudado, o aviso diz que não se atribui só à entrada', async () => {
    const admin = await newUser('Admin')
    const first = await roundWith(admin, 1, { phase: PHASE_2 })
    const second = await nextRoundWith(admin, first, 1, {
      roundNumber: 2,
      phase: PHASE_3,
      newCodebook: true,
    })

    auth.userId = admin
    const text = changesTextOf(await render(second.project, second.round))

    expect(text).toContain(ENTERS_PHASE_3_NOTE)
    expect(text).toContain(CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE)
    expect(text).not.toContain(CODEBOOK_AND_PROMPT_NOTICE)
  })

  it('a primeira rodada do projeto não mostra comparação nenhuma', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)

    auth.userId = admin
    const tree = await render(scene.project, scene.round)

    expect(findElement(tree, RoundChangesNote)).toBeNull()
    expect(textOf(tree)).not.toContain('Em relação à rodada')
  })

  it('a rodada aberta também diz o que mudou, junto do aviso de que a revisão abre no fechamento', async () => {
    const admin = await newUser('Admin')
    const first = await roundWith(admin, 1)
    const second = await nextRoundWith(admin, first, 1, {
      roundNumber: 2,
      status: 'open',
      newCodebook: true,
      newPrompt: true,
    })

    auth.userId = admin
    const tree = await render(second.project, second.round)

    expect(textOf(tree)).toContain('abre quando ela fechar')
    const text = changesTextOf(tree)
    expect(text).toContain('Em relação à rodada 1')
    expect(text).toContain(CODEBOOK_AND_PROMPT_NOTICE)
  })

  const SENT =
    'Classifique a intenção.\r\n\nDefinições:\n  - Informacional  \n\nItem de entrada:\ncomo plantar manjericão  '

  it('o Administrador lê a entrada enviada da resposta, recolhida e sem transformação', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1, { sentInputs: [SENT] })

    auth.userId = admin
    const tree = await render(scene.project, scene.round)

    const disclosure = findElement(sentInputTreeOf(tree), Disclosure)
    expect(disclosure).toBeTruthy()
    const props = disclosure!.props as Parameters<typeof Disclosure>[0]
    expect(props.summary).toBe(SENT_INPUT_SUMMARY)
    expect(props.defaultOpen).toBeUndefined()
    expect(sentInputTextOf(tree)).toBe(SENT)

    const markup = renderToStaticMarkup(createElement(AdminResponseCard, adminCardOf(tree)))
    expect(markup).toContain('<details')
    expect(markup).not.toContain('open=""')
    expect(markup).not.toContain(SENT_INPUT_MISSING)
  })

  it('o Administrador lê o texto da resposta corrente ao lado da entrada', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1, {
      texts: ['Intenção informacional.\n\nO usuário quer aprender.'],
      sentInputs: [SENT],
    })

    auth.userId = admin
    const tree = await render(scene.project, scene.round)

    expect(adminCardOf(tree).response).toEqual({
      text: 'Intenção informacional.\n\nO usuário quer aprender.',
      sentInput: SENT,
    })
    expect(
      renderToStaticMarkup(createElement(AdminResponseCard, adminCardOf(tree))),
    ).toMatch(/class="[^"]*whitespace-pre-wrap[^"]*"[^>]*>Intenção informacional/)
  })

  it('a resposta sem entrada gravada diz isso no lugar do painel', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)

    auth.userId = admin
    const tree = await render(scene.project, scene.round)
    const sent = sentInputTreeOf(tree)

    expect(textOf(sent)).toBe(SENT_INPUT_MISSING)
    expect(findElement(sent, Disclosure)).toBeNull()

    const markup = renderToStaticMarkup(createElement(AdminResponseCard, adminCardOf(tree)))
    expect(markup).toContain(SENT_INPUT_MISSING)
    expect(markup).not.toContain('<details')
  })

  it('a navegação troca a resposta e a entrada mostradas', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 3, {
      texts: ['Texto 1', 'Texto 2', 'Texto 3'],
      sentInputs: ['Entrada 1', 'Entrada 2', null],
    })

    auth.userId = admin
    const second = await render(scene.project, scene.round, scene.responses[1])
    expect(adminCardOf(second).response.text).toBe('Texto 2')
    expect(sentInputTextOf(second)).toBe('Entrada 2')

    const first = await render(scene.project, scene.round, scene.responses[0])
    expect(adminCardOf(first).response.text).toBe('Texto 1')
    expect(sentInputTextOf(first)).toBe('Entrada 1')

    const third = await render(scene.project, scene.round, scene.responses[2])
    expect(adminCardOf(third).response.text).toBe('Texto 3')
    expect(textOf(sentInputTreeOf(third))).toBe(SENT_INPUT_MISSING)
  })

  it('o avaliador na mesma rodada não recebe a entrada, nem o texto do bloco, nem a frase', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2, {
      texts: ['Texto que só o Administrador lê aqui.', 'Outro texto do bloco.'],
      sentInputs: [SENT, null],
    })
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')
    for (const response of scene.responses) {
      await addEvaluation(ownerDb, scene.round, response, ana.member, {
        cells: [note(scene, 'Informacional', 'Precisão', 'high')],
      })
    }

    auth.userId = ana.user
    for (const response of scene.responses) {
      const tree = await render(scene.project, scene.round, response)
      const markup = renderToStaticMarkup(createElement(Fragment, null, tree))
      const text = `${textOf(tree)} ${listTextOf(tree)}`

      expect(text).toContain('Ana Avaliadora')
      expect(findElement(tree, AdminResponseCard)).toBeNull()
      for (const found of [markup, text]) {
        expect(found).not.toContain('Classifique a intenção')
        expect(found).not.toContain('como plantar manjericão')
        expect(found).not.toContain('Texto que só o Administrador lê aqui.')
        expect(found).not.toContain('Outro texto do bloco.')
        expect(found).not.toContain(SENT_INPUT_MISSING)
        expect(found).not.toContain(SENT_INPUT_SUMMARY)
      }
    }
  })

  it('o avaliador abre a rodada em que avaliou, e não a rodada em que não avaliou', async () => {
    const admin = await newUser('Admin')
    const mine = await roundWith(admin, 1)
    const theirs = await roundWith(admin, 1, {
      project: mine.project,
      roundNumber: 2,
    })
    const ana = await newSignedEvaluator(mine.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(mine.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, mine.round, mine.responses[0], ana.member, {
      cells: [note(mine, 'Informacional', 'Precisão', 'high')],
    })
    await addEvaluation(ownerDb, theirs.round, theirs.responses[0], bruno, {
      cells: [note(theirs, 'Informacional', 'Precisão', 'low')],
    })

    auth.userId = ana.user
    expect(listTextOf(await render(mine.project, mine.round))).toContain(
      'Ana Avaliadora',
    )
    await expect(render(mine.project, theirs.round)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o administrador que nunca avaliou abre qualquer rodada do projeto', async () => {
    const admin = await newUser('Admin')
    const mine = await roundWith(admin, 1)
    const theirs = await roundWith(admin, 1, {
      project: mine.project,
      roundNumber: 2,
    })
    const ana = await newEvaluator(mine.project, 'Ana Avaliadora')

    await addEvaluation(ownerDb, theirs.round, theirs.responses[0], ana, {
      cells: [note(theirs, 'Informacional', 'Precisão', 'high')],
    })

    auth.userId = admin
    expect(textOf(await render(mine.project, mine.round))).toContain('Resposta 1')
    expect(listTextOf(await render(mine.project, theirs.round))).toContain(
      'Ana Avaliadora',
    )
  })

  it('a ata aparece para o Administrador e para quem avaliou na rodada, com o autor', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana.member, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await minutes(
      scene,
      admin,
      0,
      'Informacional',
      'Precisão',
      'Ficamos com alto: a resposta cita a fonte e não inventa número.',
    )

    for (const viewer of [admin, ana.user]) {
      auth.userId = viewer
      const text = listTextOf(await render(scene.project, scene.round))

      expect(text).toContain(MINUTES_LABEL)
      expect(text).toContain(
        'Ficamos com alto: a resposta cita a fonte e não inventa número.',
      )
      expect(text).toContain('por Admin,')
    }
  })

  it('o formulário da ata só existe para o Administrador', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana.member, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await minutes(scene, admin, 0, 'Informacional', 'Precisão', 'Ficamos com alto.')

    auth.userId = admin
    const mine = await render(scene.project, scene.round)
    expect(listOf(mine).consensus?.canWriteMinutes).toBe(true)
    expect(listTextOf(mine)).toContain('Salvar ata')

    auth.userId = ana.user
    const theirs = await render(scene.project, scene.round)
    expect(listOf(theirs).consensus?.canWriteMinutes).toBe(false)
    expect(listTextOf(theirs)).not.toContain('Salvar ata')
    expect(listTextOf(theirs)).toContain('Ficamos com alto.')
  })

  it('a ata de outra resposta não aparece na resposta em foco', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2)

    await minutes(
      scene,
      admin,
      1,
      'Informacional',
      'Precisão',
      'Esta ata é da segunda resposta.',
    )

    auth.userId = admin

    expect(
      listTextOf(await render(scene.project, scene.round, scene.responses[0])),
    ).not.toContain('Esta ata é da segunda resposta.')
    expect(
      listTextOf(await render(scene.project, scene.round, scene.responses[1])),
    ).toContain('Esta ata é da segunda resposta.')
  })

  it('a ata sobrevive: dois renders seguidos devolvem o mesmo texto', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 2)

    await minutes(
      scene,
      admin,
      0,
      'Informacional',
      'Precisão',
      'A equipe decidiu manter a definição como está.',
    )

    auth.userId = admin
    const first = await render(scene.project, scene.round, scene.responses[0])
    const away = await render(scene.project, scene.round, scene.responses[1])
    const back = await render(scene.project, scene.round, scene.responses[0])

    expect(listTextOf(first)).toContain('A equipe decidiu manter a definição como está.')
    expect(listTextOf(away)).not.toContain(
      'A equipe decidiu manter a definição como está.',
    )
    expect(listTextOf(back)).toContain('A equipe decidiu manter a definição como está.')
  })

  it('a revisão do avaliador não fala de coeficiente', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(scene.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana.member, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: [note(scene, 'Informacional', 'Precisão', 'low')],
    })
    await minutes(scene, admin, 0, 'Informacional', 'Precisão', 'Ficamos com alto.')
    await draft(
      scene,
      ana.member,
      0,
      'Informacional',
      'Precisão',
      'Levar à reunião: o que conta como fonte.',
    )

    auth.userId = ana.user
    const tree = await render(scene.project, scene.round)
    const text = `${textOf(tree)} ${listTextOf(tree)}`

    expect(text).toContain('Bruno Avaliador')
    expect(text).toContain(divergenceLabel('extreme'))
    expect(text).toContain('Levar à reunião: o que conta como fonte.')
    for (const word of ['Krippendorff', 'ICR', 'Alpha', 'Concordância']) {
      expect(text).not.toContain(word)
    }
  })

  it('a revisão de uma rodada da Fase 3 mostra ao avaliador as notas uma a uma, sem Qualidade', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1, { phase: PHASE_3 })
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(scene.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana.member, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await addEvaluation(ownerDb, scene.round, scene.responses[0], bruno, {
      cells: [note(scene, 'Informacional', 'Precisão', 'low')],
    })

    auth.userId = ana.user
    const tree = await render(scene.project, scene.round)
    const text = `${textOf(tree)} ${listTextOf(tree)}`

    expect(text).toContain('Ana Avaliadora')
    expect(text).toContain('Bruno Avaliador')
    expect(listTextOf(tree)).toContain(scaleLabel('high'))
    expect(listTextOf(tree)).toContain(scaleLabel('low'))
    expect(text).not.toContain('Qualidade')
    expect(text).not.toContain('%')
    expect(findElement(tree, QualityPanel)).toBeNull()
    expect(findElement(tree, QualityValue)).toBeNull()
  })

  it('o rascunho de um avaliador não aparece na página do outro avaliador', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')
    const bruno = await newSignedEvaluator(scene.project, 'Bruno Avaliador')

    for (const member of [ana.member, bruno.member]) {
      await addEvaluation(ownerDb, scene.round, scene.responses[0], member, {
        cells: [note(scene, 'Informacional', 'Precisão', 'high')],
      })
    }
    await draft(
      scene,
      ana.member,
      0,
      'Informacional',
      'Precisão',
      'Rascunho da Ana: perguntar se citar a fonte exige link.',
    )

    auth.userId = ana.user
    expect(listTextOf(await render(scene.project, scene.round))).toContain(
      'Rascunho da Ana: perguntar se citar a fonte exige link.',
    )

    auth.userId = bruno.user
    const theirs = await render(scene.project, scene.round)
    expect(listTextOf(theirs)).not.toContain('Rascunho da Ana')
    expect(mineOf(theirs, cellOf(scene, 'Informacional', 'Precisão'))).toBeNull()
  })

  it('o rascunho do avaliador não aparece na página do Administrador', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana.member, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await draft(
      scene,
      ana.member,
      0,
      'Informacional',
      'Precisão',
      'Rascunho da Ana: a escala está apertada demais.',
    )

    auth.userId = admin
    const tree = await render(scene.project, scene.round)

    expect(listTextOf(tree)).not.toContain('Rascunho da Ana')
    expect(listOf(tree).consensus?.canWritePrivate).toBe(false)
    expect(mineOf(tree, cellOf(scene, 'Informacional', 'Precisão'))).toBeNull()
  })

  it('o próprio autor vê o seu rascunho preenchido no formulário', async () => {
    const admin = await newUser('Admin')
    const scene = await roundWith(admin, 1)
    const ana = await newSignedEvaluator(scene.project, 'Ana Avaliadora')

    await addEvaluation(ownerDb, scene.round, scene.responses[0], ana.member, {
      cells: [note(scene, 'Informacional', 'Precisão', 'high')],
    })
    await draft(
      scene,
      ana.member,
      0,
      'Informacional',
      'Precisão',
      'Minha dúvida: resposta sem número conta como precisa?',
    )

    auth.userId = ana.user
    const tree = await render(scene.project, scene.round)
    const text = listTextOf(tree)

    expect(listOf(tree).consensus?.canWritePrivate).toBe(true)
    expect(mineOf(tree, cellOf(scene, 'Informacional', 'Precisão'))?.text).toBe(
      'Minha dúvida: resposta sem número conta como precisa?',
    )
    expect(text).toContain(PRIVATE_LABEL)
    expect(text).toContain('Salvar anotação')
    expect(text).toContain('Minha dúvida: resposta sem número conta como precisa?')
    expect(text).not.toContain('Salvar ata')
  })

  it('o avaliador não alcança a ata nem o rascunho de rodada em que não avaliou', async () => {
    const admin = await newUser('Admin')
    const mine = await roundWith(admin, 1)
    const theirs = await roundWith(admin, 1, {
      project: mine.project,
      roundNumber: 2,
    })
    const ana = await newSignedEvaluator(mine.project, 'Ana Avaliadora')
    const bruno = await newEvaluator(mine.project, 'Bruno Avaliador')

    await addEvaluation(ownerDb, mine.round, mine.responses[0], ana.member, {
      cells: [note(mine, 'Informacional', 'Precisão', 'high')],
    })
    await addEvaluation(ownerDb, theirs.round, theirs.responses[0], bruno, {
      cells: [note(theirs, 'Informacional', 'Precisão', 'low')],
    })
    await minutes(
      theirs,
      admin,
      0,
      'Informacional',
      'Precisão',
      'Ata da rodada 2, que a Ana não avaliou.',
    )
    await draft(
      theirs,
      ana.member,
      0,
      'Informacional',
      'Precisão',
      'Rascunho da Ana na rodada 2.',
    )

    auth.userId = ana.user
    await expect(render(mine.project, theirs.round)).rejects.toThrow('NEXT_NOTFOUND')

    const text = listTextOf(await render(mine.project, mine.round))
    expect(text).not.toContain('Ata da rodada 2, que a Ana não avaliou.')
    expect(text).not.toContain('Rascunho da Ana na rodada 2.')
  })
})
