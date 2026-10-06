import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import { isValidElement, type ReactElement } from 'react'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

const llm = vi.hoisted(() => ({
  inputs: [] as string[],
  text: 'Categoria: Informacional',
}))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))
vi.mock('@/lib/ai', () => ({
  llmModel: () => 'modelo-pedido',
  askLlm: async (input: string) => {
    llm.inputs.push(input)
    return {
      text: llm.text,
      model: 'modelo-pedido',
      modelVersion: 'modelo-resolvido-2026-05-01',
    }
  },
}))

import {
  closeRound,
  createRound,
  generateResponses,
} from '@/app/projects/[id]/(tabs)/rounds/actions'
import { submitEvaluation } from '@/app/projects/[id]/(tabs)/evaluate/actions'
import { markOutlier } from '@/app/projects/[id]/(tabs)/rounds/outlier-actions'
import { loadRoundOutliers } from '@/app/projects/[id]/(tabs)/rounds/outliers'
import { saveConsensusNote } from '@/app/projects/[id]/(tabs)/rounds/consensus-actions'
import { listReviewableRounds } from '@/app/projects/[id]/(tabs)/rounds/review'
import {
  requireReviewAccess,
  requireReviewableRound,
} from '@/app/projects/[id]/(tabs)/rounds/review-access'
import { listRounds } from '@/app/projects/[id]/(tabs)/rounds/rounds'
import ProjectRoundsPage from '@/app/projects/[id]/(tabs)/rounds/page'
import { GenerateResponses } from '@/app/projects/[id]/(tabs)/rounds/generate-responses'
import { selectionBlockers } from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { itemUsageLabel } from '@/app/projects/[id]/round-usage'
import { projectReferenceRound } from '@/app/projects/[id]/(tabs)/rounds/reference-round'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { CODEBOOK_HEADING } from '@/app/projects/[id]/pipeline/llm-input'
import { PHASE_3, PHASE_4 } from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb, consensusNotes, evaluations, responses, rounds } from '@/lib/db'
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
  cleanup,
} from '@/test/helpers'

type Cell = { definitionId: string; criterionId: string }

type Evaluator = { user: string; member: string }

type Scene = {
  admin: string
  project: string
  codebookVersion: string
  promptVersion: string
  referenceRound: string
  usedItem: string
  ana: Evaluator
  carla: Evaluator
  davi: Evaluator
  items: string[]
  cells: Cell[]
}

type Phase4Round = { round: string; responses: string[] }

type GenerateProps = Parameters<typeof GenerateResponses>[0]

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

async function generateOf(projectId: string): Promise<GenerateProps> {
  const tree = await ProjectRoundsPage({ params: Promise.resolve({ id: projectId }) })
  const element = findElement(tree, GenerateResponses)
  expect(element).toBeTruthy()
  return element!.props as GenerateProps
}

function projectForm(projectId: string): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  return form
}

function roundForm(projectId: string, roundId: string): FormData {
  const form = projectForm(projectId)
  form.set('round_id', roundId)
  return form
}

function generateForm(projectId: string, roundId: string, itemIds: string[]): FormData {
  const form = roundForm(projectId, roundId)
  for (const itemId of itemIds) form.append('item_ids', itemId)
  return form
}

function evaluationForm(scene: Scene, responseId: string): FormData {
  const form = projectForm(scene.project)
  form.set('response_id', responseId)
  for (const cell of scene.cells) {
    form.set(`score_${cell.definitionId}_${cell.criterionId}`, 'high')
  }
  return form
}

function roundsOf(projectId: string) {
  return ownerDb
    .select({
      id: rounds.id,
      roundNumber: rounds.roundNumber,
      status: rounds.status,
      phase: rounds.phase,
      codebookVersionId: rounds.codebookVersionId,
      promptVersionId: rounds.promptVersionId,
    })
    .from(rounds)
    .where(eq(rounds.projectId, projectId))
    .orderBy(asc(rounds.roundNumber))
}

function responsesOf(roundId: string) {
  return ownerDb
    .select({
      id: responses.id,
      inputItemId: responses.inputItemId,
      codebookVersionId: responses.codebookVersionId,
      promptVersionId: responses.promptVersionId,
    })
    .from(responses)
    .where(eq(responses.roundId, roundId))
    .orderBy(asc(responses.createdAt))
}

function evaluationsOf(roundId: string) {
  return ownerDb
    .select({
      responseId: evaluations.responseId,
      projectMemberId: evaluations.projectMemberId,
    })
    .from(evaluations)
    .where(eq(evaluations.roundId, roundId))
}

describe('app/projects/[id]/rounds — o ciclo completo de uma rodada da Fase 4', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function newEvaluator(project: string, name: string): Promise<Evaluator> {
    const user = await newUser(name)
    return { user, member: await addActiveEvaluator(ownerDb, project, user) }
  }

  async function scene(): Promise<Scene> {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase: PHASE_4 })
    projs.push(project)

    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        {
          title: 'Informacional',
          type: 'category',
          description: 'Busca por informação.',
          criteria: [{ name: 'Clareza' }],
        },
      ],
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin)

    const ana = await newEvaluator(project, 'Ana')
    const carla = await newEvaluator(project, 'Carla')
    const davi = await newEvaluator(project, 'Davi')

    const referenceRound = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1, status: 'closed', phase: PHASE_3 },
    )
    const usedItem = await addInputItem(ownerDb, project, admin, { name: 'Item da Fase 3' })
    const usedResponse = await addResponse(ownerDb, referenceRound, usedItem, admin)
    await addEvaluation(ownerDb, referenceRound, usedResponse, ana.member)

    const items: string[] = []
    for (let index = 1; index <= 3; index += 1) {
      items.push(
        await addInputItem(ownerDb, project, admin, {
          name: `Item novo ${index}`,
          content: `conteúdo do item novo ${index}`,
        }),
      )
    }

    const codebook = await loadCodebookVersion(project, codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria).map((cell) => ({
      definitionId: cell.definition.id,
      criterionId: cell.criterion.id,
    }))

    return {
      admin,
      project,
      codebookVersion,
      promptVersion,
      referenceRound,
      usedItem,
      ana,
      carla,
      davi,
      items,
      cells,
    }
  }

  async function openPhase4Round(s: Scene): Promise<Phase4Round> {
    auth.userId = s.admin
    expect(await createRound(null, projectForm(s.project))).toMatchObject({
      ok: true,
      roundNumber: 2,
    })
    const round = (await roundsOf(s.project)).find((row) => row.roundNumber === 2)!

    const generated = await generateResponses(
      null,
      generateForm(s.project, round.id, s.items.slice(0, 2)),
    )
    expect(generated).toMatchObject({ ok: true, failed: [] })

    return { round: round.id, responses: (await responsesOf(round.id)).map((row) => row.id) }
  }

  async function evaluate(s: Scene, evaluator: Evaluator, responseIds: string[]) {
    auth.userId = evaluator.user
    for (const responseId of responseIds) {
      const sent = await submitEvaluation(null, evaluationForm(s, responseId)).catch(
        (err: Error) => err.message,
      )
      if (typeof sent === 'string') {
        expect(sent).toContain(`NEXT_REDIRECT:/projects/${s.project}/evaluate?`)
      } else {
        expect(sent).toMatchObject({ ok: true })
      }
    }
  }

  async function closedPhase4Round(s: Scene): Promise<Phase4Round> {
    const opened = await openPhase4Round(s)
    for (const evaluator of [s.ana, s.carla, s.davi]) {
      await evaluate(s, evaluator, opened.responses)
    }
    auth.userId = s.admin
    expect(await closeRound(null, roundForm(s.project, opened.round))).toMatchObject({
      ok: true,
      roundNumber: 2,
    })
    return opened
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
    llm.inputs = []
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  describe('abrir e gerar', () => {
    it('a rodada 2 nasce aberta na Fase 4, e as respostas levam as versões da rodada', async () => {
      const s = await scene()
      const { round } = await openPhase4Round(s)

      const [, created] = await roundsOf(s.project)
      expect(created).toMatchObject({
        id: round,
        roundNumber: 2,
        status: 'open',
        phase: PHASE_4,
        codebookVersionId: s.codebookVersion,
        promptVersionId: s.promptVersion,
      })

      const rows = await responsesOf(round)
      expect(rows.map((row) => row.inputItemId)).toEqual(s.items.slice(0, 2))
      for (const row of rows) {
        expect(row.codebookVersionId).toBe(s.codebookVersion)
        expect(row.promptVersionId).toBe(s.promptVersion)
      }

      expect(llm.inputs).toHaveLength(2)
      for (const input of llm.inputs) {
        expect(input).toContain(CODEBOOK_HEADING)
        expect(input).toContain('Busca por informação.')
      }
    })

    it('o item já usado na rodada de referência da Fase 3 é aceito na rodada da Fase 4', async () => {
      const s = await scene()

      auth.userId = s.admin
      expect(await createRound(null, projectForm(s.project))).toMatchObject({
        ok: true,
        roundNumber: 2,
      })
      const round = (await roundsOf(s.project)).find((row) => row.roundNumber === 2)!

      const before = await generateOf(s.project)
      const offered = before.items.find((item) => item.id === s.usedItem)!
      expect(offered.rounds).toEqual([{ roundNumber: 1, phase: PHASE_3 }])
      expect(itemUsageLabel(offered.rounds)).toBe('usado na rodada 1 (Fase 3)')
      expect(before.generated).toEqual([])
      expect(
        selectionBlockers([s.usedItem], {
          available: before.items.map((item) => item.id),
          usedInRound: before.generated.map((response) => response.itemId),
        }),
      ).toEqual([])

      const generated = await generateResponses(
        null,
        generateForm(s.project, round.id, [s.usedItem]),
      )
      expect(generated).toMatchObject({ ok: true, failed: [] })
      expect((await responsesOf(round.id)).map((row) => row.inputItemId)).toEqual([
        s.usedItem,
      ])

      const after = await generateOf(s.project)
      expect(after.items.find((item) => item.id === s.usedItem)!.rounds).toEqual([
        { roundNumber: 1, phase: PHASE_3 },
        { roundNumber: 2, phase: PHASE_4 },
      ])
    })
  })

  describe('avaliar', () => {
    it('o veterano e os avaliadores novos avaliam, e o segundo envio é recusado como em qualquer fase', async () => {
      const s = await scene()
      const { round, responses: responseIds } = await openPhase4Round(s)

      for (const evaluator of [s.ana, s.carla, s.davi]) {
        await evaluate(s, evaluator, responseIds)
      }

      const rows = await evaluationsOf(round)
      expect(rows).toHaveLength(6)
      for (const responseId of responseIds) {
        expect(
          rows
            .filter((row) => row.responseId === responseId)
            .map((row) => row.projectMemberId)
            .sort(),
        ).toEqual([s.ana.member, s.carla.member, s.davi.member].sort())
      }

      auth.userId = s.carla.user
      expect(await submitEvaluation(null, evaluationForm(s, responseIds[0]))).toMatchObject({
        error: expect.stringContaining('já enviou'),
      })
      expect(await evaluationsOf(round)).toHaveLength(6)
    })
  })

  describe('fechar', () => {
    it('a rodada fecha, e gerar ou avaliar depois é recusado com as mensagens de sempre', async () => {
      const s = await scene()
      const { round, responses: responseIds } = await openPhase4Round(s)

      await evaluate(s, s.ana, responseIds)
      await evaluate(s, s.carla, responseIds)
      await evaluate(s, s.davi, responseIds.slice(0, 1))

      auth.userId = s.admin
      expect(await closeRound(null, roundForm(s.project, round))).toMatchObject({
        ok: true,
        roundNumber: 2,
      })
      const [, closed] = await roundsOf(s.project)
      expect(closed).toMatchObject({ status: 'closed', phase: PHASE_4 })

      const calls = llm.inputs.length
      const generated = await generateResponses(
        null,
        generateForm(s.project, round, s.items.slice(2)),
      )
      expect(generated).toMatchObject({ error: expect.stringMatching(/fechada/i) })
      expect(llm.inputs).toHaveLength(calls)
      expect(await responsesOf(round)).toHaveLength(2)

      auth.userId = s.davi.user
      expect(await submitEvaluation(null, evaluationForm(s, responseIds[1]))).toMatchObject({
        error: expect.stringContaining('A rodada 2 já foi fechada'),
      })
      expect(await evaluationsOf(round)).toHaveLength(5)
    })
  })

  describe('depois de fechar', () => {
    it('o veterano é marcado como outlier na rodada 2 e sai do cálculo dela', async () => {
      const s = await scene()
      const { round } = await closedPhase4Round(s)

      auth.userId = s.admin
      const form = roundForm(s.project, round)
      form.set('project_member_id', s.ana.member)
      form.set('reason', 'Já avaliou na Fase 3; a Fase 4 mede quem chega agora.')
      expect(await markOutlier(null, form)).toMatchObject({ ok: true })

      const marks = await loadRoundOutliers(round)
      expect(marks.map((mark) => mark.projectMemberId)).toEqual([s.ana.member])
      expect(await loadRoundOutliers(s.referenceRound)).toEqual([])
    })

    it('a anotação de consenso é gravada numa célula da rodada 2', async () => {
      const s = await scene()
      const { round, responses: responseIds } = await closedPhase4Round(s)
      const [cell] = s.cells

      function noteForm(text: string): FormData {
        const form = roundForm(s.project, round)
        form.set('response_id', responseIds[0])
        form.set('definition_id', cell.definitionId)
        form.set('criterion_id', cell.criterionId)
        form.set('text', text)
        return form
      }

      auth.userId = s.admin
      expect(await saveConsensusNote(null, noteForm('Decisão da equipe na Fase 4.'))).toMatchObject({
        ok: true,
        saved: true,
      })

      auth.userId = s.carla.user
      expect(await saveConsensusNote(null, noteForm('Rascunho da Carla.'))).toMatchObject({
        ok: true,
        saved: true,
      })

      const notes = await ownerDb
        .select({
          roundId: consensusNotes.roundId,
          visibility: consensusNotes.visibility,
          text: consensusNotes.text,
        })
        .from(consensusNotes)
        .where(eq(consensusNotes.responseId, responseIds[0]))

      expect(notes.sort((a, b) => a.visibility.localeCompare(b.visibility))).toEqual([
        { roundId: round, visibility: 'private', text: 'Rascunho da Carla.' },
        { roundId: round, visibility: 'shared', text: 'Decisão da equipe na Fase 4.' },
      ])
    })

    it('na revisão, quem é novo na Fase 4 alcança só a rodada 2, e o veterano alcança as duas', async () => {
      const s = await scene()
      const { round } = await closedPhase4Round(s)

      expect(
        (await listReviewableRounds(s.project, s.carla.member)).map((row) => row.roundNumber),
      ).toEqual([2])
      expect(
        (await listReviewableRounds(s.project, s.ana.member)).map((row) => row.roundNumber),
      ).toEqual([1, 2])

      const carla = await requireReviewAccess(s.project, s.carla.user)
      expect((await requireReviewableRound(carla, round)).id).toBe(round)
      await expect(requireReviewableRound(carla, s.referenceRound)).rejects.toThrow(
        'NEXT_NOT_FOUND',
      )

      const ana = await requireReviewAccess(s.project, s.ana.user)
      expect((await requireReviewableRound(ana, s.referenceRound)).id).toBe(s.referenceRound)
    })
  })

  describe('a rodada seguinte', () => {
    it('abre como rodada 3 na Fase 4, com as mesmas versões, e a referência continua a rodada 1', async () => {
      const s = await scene()
      await closedPhase4Round(s)

      auth.userId = s.admin
      expect(await createRound(null, projectForm(s.project))).toMatchObject({
        ok: true,
        roundNumber: 3,
      })

      const [, second, third] = await roundsOf(s.project)
      expect(third).toMatchObject({
        roundNumber: 3,
        status: 'open',
        phase: PHASE_4,
        codebookVersionId: second.codebookVersionId,
        promptVersionId: second.promptVersionId,
      })

      expect(projectReferenceRound(await listRounds(s.project))?.roundNumber).toBe(1)
    })
  })

  describe('o Avaliador é barrado', () => {
    it('quem avalia na Fase 4 não cria nem fecha rodada', async () => {
      const s = await scene()

      auth.userId = s.carla.user
      expect(await createRound(null, projectForm(s.project))).toMatchObject({
        error: expect.stringContaining('Apenas o administrador do projeto pode criá-la'),
      })
      expect(await roundsOf(s.project)).toHaveLength(1)

      const { round } = await openPhase4Round(s)

      auth.userId = s.carla.user
      expect(await closeRound(null, roundForm(s.project, round))).toMatchObject({
        error: expect.stringContaining('Apenas o administrador do projeto pode fechá-la'),
      })
      const [, open] = await roundsOf(s.project)
      expect(open.status).toBe('open')
    })
  })
})
