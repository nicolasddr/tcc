import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import { submitEvaluation } from '@/app/projects/[id]/(tabs)/evaluate/actions'
import {
  loadEvaluatedResponseIds,
  loadEvaluationOf,
} from '@/app/projects/[id]/(tabs)/evaluate/evaluation'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { JUSTIFICATION_MAX } from '@/lib/limits'
import {
  ownerDb,
  evaluations,
  projectMembers,
  responses,
  scores,
} from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  memberId as memberIdOf,
  cleanup,
} from '@/test/helpers'

type Cell = { definitionId: string; criterionId: string }

type Scenario = {
  project: string
  round: string
  response: string
  codebookVersion: string
  cells: Cell[]
}

function evaluationsOf(responseId: string) {
  return ownerDb
    .select({
      id: evaluations.id,
      roundId: evaluations.roundId,
      responseId: evaluations.responseId,
      projectMemberId: evaluations.projectMemberId,
      submittedAt: evaluations.submittedAt,
    })
    .from(evaluations)
    .where(eq(evaluations.responseId, responseId))
}

function scoresOf(evaluationId: string) {
  return ownerDb
    .select({
      definitionId: scores.definitionId,
      criterionId: scores.criterionId,
      value: scores.value,
      justification: scores.justification,
    })
    .from(scores)
    .where(eq(scores.evaluationId, evaluationId))
    .orderBy(asc(scores.definitionId), asc(scores.criterionId))
}

describe('app/projects/[id]/evaluate/actions — enviar a avaliação de uma resposta', () => {
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
      definitions?: { title: string; criteria?: { name: string }[] }[]
      generalCriteria?: { name: string }[]
      status?: 'open' | 'closed'
    } = {},
  ): Promise<Scenario> {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase: PHASE_2 })
    projs.push(project)

    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      definitions: (
        opts.definitions ?? [{ title: 'Informacional', criteria: [{ name: 'Clareza' }] }]
      ).map((definition) => ({
        title: definition.title,
        type: 'category',
        criteria: definition.criteria ?? [],
      })),
      generalCriteria: opts.generalCriteria,
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    const round = await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      status: opts.status ?? 'open',
    })
    const item = await addInputItem(ownerDb, project, admin)
    const response = await addResponse(ownerDb, round, item, admin)

    const codebook = await loadCodebookVersion(project, codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria).map((cell) => ({
      definitionId: cell.definition.id,
      criterionId: cell.criterion.id,
    }))

    return { project, round, response, codebookVersion, cells }
  }

  async function newEvaluator(project: string, name = 'Avaliadora'): Promise<string> {
    const user = await newUser(name)
    await addActiveEvaluator(ownerDb, project, user)
    return user
  }

  function form(
    scene: Scenario,
    filled: Cell[] = scene.cells,
    opts: { value?: string; justification?: string } = {},
  ): FormData {
    const data = new FormData()
    data.set('project_id', scene.project)
    data.set('response_id', scene.response)
    for (const cell of filled) {
      const key = `${cell.definitionId}_${cell.criterionId}`
      data.set(`score_${key}`, opts.value ?? 'high')
      if (opts.justification !== undefined) {
        data.set(`justification_${key}`, opts.justification)
      }
    }
    return data
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o envio completo grava a avaliação com rodada, resposta, vínculo e data', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)

    auth.userId = evaluator
    const result = await submitEvaluation(null, form(scene))
    expect(result).toMatchObject({ ok: true })

    const [evaluation] = await evaluationsOf(scene.response)
    expect(evaluation.roundId).toBe(scene.round)
    expect(evaluation.responseId).toBe(scene.response)
    expect(evaluation.projectMemberId).toBe(member)
    expect(evaluation.submittedAt).toBeTruthy()
  })

  it('grava uma nota por célula, com a chave (avaliação, definição, critério)', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        { title: 'Informacional', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', criteria: [{ name: 'Precisão' }] },
      ],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    await submitEvaluation(null, form(scene))

    const [evaluation] = await evaluationsOf(scene.response)
    const rows = await scoresOf(evaluation.id)
    expect(rows).toHaveLength(scene.cells.length)
    expect(new Set(rows.map((row) => `${row.definitionId}_${row.criterionId}`))).toEqual(
      new Set(scene.cells.map((cell) => `${cell.definitionId}_${cell.criterionId}`)),
    )
    expect(rows.every((row) => row.value === 'high')).toBe(true)
  })

  it('o critério geral gera uma nota em cada definição, e as duas coexistem', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        { title: 'Informacional', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', criteria: [{ name: 'Precisão' }] },
      ],
      generalCriteria: [{ name: 'Aderência' }],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const result = await submitEvaluation(null, form(scene))
    expect(result).toMatchObject({ ok: true })

    const [evaluation] = await evaluationsOf(scene.response)
    const rows = await scoresOf(evaluation.id)
    expect(rows).toHaveLength(4)

    const general = scene.cells.filter(
      (cell) =>
        scene.cells.filter((other) => other.criterionId === cell.criterionId).length === 2,
    )
    expect(general).toHaveLength(2)
    expect(new Set(general.map((cell) => cell.definitionId)).size).toBe(2)

    for (const cell of general) {
      expect(
        rows.some(
          (row) =>
            row.definitionId === cell.definitionId && row.criterionId === cell.criterionId,
        ),
      ).toBe(true)
    }
  })

  it('o envio incompleto é recusado, a mensagem nomeia a definição e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        { title: 'Informacional', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', criteria: [{ name: 'Precisão' }] },
      ],
    })
    const evaluator = await newEvaluator(scene.project)
    const partial = scene.cells.slice(0, 1)

    auth.userId = evaluator
    const result = await submitEvaluation(null, form(scene, partial))
    expect(result).toMatchObject({ error: expect.stringContaining('“Transacional”') })

    expect(await evaluationsOf(scene.response)).toHaveLength(0)
    expect(await ownerDb.select({ id: scores.id }).from(scores)).toHaveLength(0)
  })

  it('o segundo envio da mesma resposta pelo mesmo vínculo é recusado, e o primeiro fica intacto', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    await submitEvaluation(null, form(scene))
    const [first] = await evaluationsOf(scene.response)

    const again = await submitEvaluation(null, form(scene, scene.cells, { value: 'low' }))
    expect(again).toMatchObject({ error: expect.stringContaining('já enviou') })

    const rows = await evaluationsOf(scene.response)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(first.id)
    expect((await scoresOf(first.id)).every((row) => row.value === 'high')).toBe(true)
  })

  it('o vínculo de avaliador de outro projeto é recusado', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const other = await scenario(admin, {})
    const evaluator = await newEvaluator(other.project)

    auth.userId = evaluator
    const result = await submitEvaluation(null, form(scene))
    expect(result).toMatchObject({ error: expect.stringContaining('vínculo de avaliador') })
    expect(await evaluationsOf(scene.response)).toHaveLength(0)
  })

  it('o administrador sem vínculo de avaliador é recusado', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)

    auth.userId = admin
    const result = await submitEvaluation(null, form(scene))
    expect(result).toMatchObject({ error: expect.stringContaining('vínculo de avaliador') })
    expect(await evaluationsOf(scene.response)).toHaveLength(0)
  })

  it('o administrador-avaliador grava apontando para o vínculo de avaliador', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    await addActiveEvaluator(ownerDb, scene.project, admin)

    auth.userId = admin
    const result = await submitEvaluation(null, form(scene))
    expect(result).toMatchObject({ ok: true })

    const [evaluation] = await evaluationsOf(scene.response)
    const [member] = await ownerDb
      .select({ role: projectMembers.role, userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.id, evaluation.projectMemberId))
    expect(member.role).toBe('evaluator')
    expect(member.userId).toBe(admin)
  })

  it('a avaliação em rodada fechada é recusada', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { status: 'closed' })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const result = await submitEvaluation(null, form(scene))
    expect(result).toMatchObject({ error: expect.stringContaining('fechada') })
    expect(await evaluationsOf(scene.response)).toHaveLength(0)
  })

  it('a resposta de outro projeto é recusada', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const other = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    const data = form(scene)
    data.set('response_id', other.response)

    auth.userId = evaluator
    const result = await submitEvaluation(null, data)
    expect(result).toMatchObject({ error: expect.stringContaining('não existe mais') })
    expect(await evaluationsOf(other.response)).toHaveLength(0)
  })

  it('a justificativa acima do limite é recusada e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const result = await submitEvaluation(
      null,
      form(scene, scene.cells, { justification: 'x'.repeat(JUSTIFICATION_MAX + 1) }),
    )
    expect(result).toMatchObject({
      error: expect.stringContaining(String(JUSTIFICATION_MAX)),
    })
    expect(await evaluationsOf(scene.response)).toHaveLength(0)
  })

  it('a justificativa vazia grava null, e a preenchida grava o texto', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        { title: 'Informacional', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', criteria: [{ name: 'Precisão' }] },
      ],
    })
    const evaluator = await newEvaluator(scene.project)

    const data = form(scene, scene.cells, { justification: '   ' })
    const first = scene.cells[0]
    data.set(
      `justification_${first.definitionId}_${first.criterionId}`,
      '  Resposta genérica demais.  ',
    )

    auth.userId = evaluator
    await submitEvaluation(null, data)

    const [evaluation] = await evaluationsOf(scene.response)
    const rows = await scoresOf(evaluation.id)
    const justified = rows.find(
      (row) => row.definitionId === first.definitionId && row.criterionId === first.criterionId,
    )
    expect(justified!.justification).toBe('Resposta genérica demais.')
    expect(
      rows.filter((row) => row !== justified).every((row) => row.justification === null),
    ).toBe(true)
  })

  it('o valor fora da escala é recusado e nada é gravado', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const result = await submitEvaluation(null, form(scene, scene.cells, { value: 'altíssimo' }))
    expect(result).toMatchObject({ error: expect.stringContaining('escala') })
    expect(await evaluationsOf(scene.response)).toHaveLength(0)
  })

  it('o round_id gravado bate com o round_id da resposta', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    await submitEvaluation(null, form(scene))

    const [evaluation] = await evaluationsOf(scene.response)
    const [response] = await ownerDb
      .select({ roundId: responses.roundId })
      .from(responses)
      .where(eq(responses.id, scene.response))
    expect(evaluation.roundId).toBe(response.roundId)
  })

  it('os loaders leem a avaliação enviada e a lista de respostas já avaliadas', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)
    const outra = await newEvaluator(scene.project, 'Outra')
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    const outroMember = await ownerDb
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, scene.project),
          eq(projectMembers.userId, outra),
        ),
      )

    auth.userId = evaluator
    await submitEvaluation(null, form(scene, scene.cells, { justification: 'Vaga.' }))

    const evaluation = await loadEvaluationOf(scene.response, member)
    expect(evaluation).toMatchObject({ responseId: scene.response, roundId: scene.round })
    expect(evaluation!.scores).toHaveLength(scene.cells.length)
    expect(evaluation!.scores[0]).toMatchObject({ value: 'high', justification: 'Vaga.' })

    expect(await loadEvaluatedResponseIds(scene.round, member)).toEqual([scene.response])
    expect(await loadEvaluatedResponseIds(scene.round, outroMember[0].id)).toEqual([])
    expect(await loadEvaluationOf(scene.response, outroMember[0].id)).toBeNull()
  })
})
