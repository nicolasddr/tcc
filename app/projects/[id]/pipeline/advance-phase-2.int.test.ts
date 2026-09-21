import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { asc, count, eq } from 'drizzle-orm'

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

import { advancePhase } from '@/app/projects/[id]/pipeline/actions'
import {
  PHASE_1,
  PHASE_2,
  PHASE_3,
  phase2BlockedMessage,
  wrongPhaseMessage,
} from '@/app/projects/[id]/pipeline/preconditions'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { listRounds } from '@/app/projects/[id]/(tabs)/rounds/rounds'
import { loadRoundObservations } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { AGREEMENT_BANDS } from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { ordinalAlpha } from '@/lib/agreement'
import {
  ownerDb,
  projects,
  codebookVersions,
  promptVersions,
  evaluations,
  rounds,
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
  addEvaluation,
  cleanup,
  type CellFixture,
  type DefinitionFixture,
} from '@/test/helpers'

const ONE_CELL: DefinitionFixture[] = [
  { title: 'Navegacional', type: 'category', criteria: [{ name: 'Clareza' }] },
]

const FROZEN = '2026-01-01T12:00:00.000Z'

type Cell = { definitionId: string; criterionId: string }

type Artifacts = { codebook: string; prompt: string; cells: Cell[] }

type Scene = { round: string; responses: string[] }

describe('app/projects/[id]/pipeline/actions — avanço da Fase 2 para a Fase 3', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function newProject(admin: string, phase = PHASE_2): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
    projs.push(id)
    return id
  }

  async function phaseOf(projectId: string): Promise<number> {
    const [row] = await ownerDb
      .select({ phase: projects.phase })
      .from(projects)
      .where(eq(projects.id, projectId))
    return row.phase
  }

  function advanceFd(projectId: string): FormData {
    const form = new FormData()
    form.set('project_id', projectId)
    return form
  }

  async function seedArtifacts(project: string, admin: string): Promise<Artifacts> {
    const codebook = await addCodebookVersion(ownerDb, project, admin, {
      definitions: ONE_CELL,
      usedAt: FROZEN,
    })
    const prompt = await addPromptVersion(ownerDb, project, admin, { usedAt: FROZEN })

    const version = await loadCodebookVersion(project, codebook, ownerDb)
    const cells = resolveCells(version!.definitions, version!.criteria).map((cell) => ({
      definitionId: cell.definition.id,
      criterionId: cell.criterion.id,
    }))

    return { codebook, prompt, cells }
  }

  async function seedRound(
    project: string,
    admin: string,
    artifacts: Artifacts,
    opts: { roundNumber: number; status: 'open' | 'closed'; responses?: number },
  ): Promise<Scene> {
    const round = await addRound(
      ownerDb,
      project,
      admin,
      artifacts.codebook,
      artifacts.prompt,
      { roundNumber: opts.roundNumber, status: opts.status },
    )

    const responses: string[] = []
    for (let index = 0; index < (opts.responses ?? 0); index++) {
      const item = await addInputItem(ownerDb, project, admin, {
        name: `Item ${opts.roundNumber}.${index}`,
      })
      responses.push(await addResponse(ownerDb, round, item, admin))
    }

    return { round, responses }
  }

  async function rate(
    artifacts: Artifacts,
    scene: Scene,
    evaluator: string,
    values: readonly CellFixture['value'][],
  ): Promise<void> {
    for (const [index, value] of values.entries()) {
      await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
        cells: artifacts.cells.map((cell) => ({ ...cell, value })),
      })
    }
  }

  function agreementOf(roundId: string) {
    return loadRoundObservations(roundId, ownerDb).then(ordinalAlpha)
  }

  function roundStateOf(projectId: string) {
    return listRounds(projectId, ownerDb).then((list) =>
      list.map(({ roundNumber, status, closedAt }) => ({ roundNumber, status, closedAt })),
    )
  }

  async function evaluationsOf(projectId: string): Promise<number> {
    const [row] = await ownerDb
      .select({ value: count() })
      .from(evaluations)
      .innerJoin(rounds, eq(rounds.id, evaluations.roundId))
      .where(eq(rounds.projectId, projectId))
    return row.value
  }

  async function usageOf(projectId: string) {
    const codebooks = await ownerDb
      .select({ versionNumber: codebookVersions.versionNumber, usedAt: codebookVersions.usedAt })
      .from(codebookVersions)
      .where(eq(codebookVersions.projectId, projectId))
      .orderBy(asc(codebookVersions.versionNumber))
    const prompts = await ownerDb
      .select({ versionNumber: promptVersions.versionNumber, usedAt: promptVersions.usedAt })
      .from(promptVersions)
      .where(eq(promptVersions.projectId, projectId))
      .orderBy(asc(promptVersions.versionNumber))
    return { codebooks, prompts }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('com uma rodada fechada e nenhuma aberta, o Administrador avança para a Fase 3', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    await seedRound(project, admin, artifacts, { roundNumber: 1, status: 'closed' })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_3,
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('recusa o avanço com rodada aberta, nomeando a rodada, e a fase não muda', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    await seedRound(project, admin, artifacts, { roundNumber: 1, status: 'closed' })
    await seedRound(project, admin, artifacts, { roundNumber: 2, status: 'open' })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: phase2BlockedMessage([{ key: 'open_round', roundNumber: 2 }]),
    })
    expect(await phaseOf(project)).toBe(PHASE_2)
  })

  it('recusa o avanço sem nenhuma rodada, cobrando a rodada fechada, e a fase não muda', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await seedArtifacts(project, admin)

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: phase2BlockedMessage([{ key: 'no_closed_round' }]),
    })
    expect(await phaseOf(project)).toBe(PHASE_2)
  })

  it('só com rodada aberta, a recusa cobre as duas pendências de uma vez', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    await seedRound(project, admin, artifacts, { roundNumber: 1, status: 'open' })

    auth.userId = admin
    const denied = await advancePhase(null, advanceFd(project))
    expect(denied).toEqual({
      error: phase2BlockedMessage([
        { key: 'open_round', roundNumber: 1 },
        { key: 'no_closed_round' },
      ]),
    })
    expect(denied).toEqual({
      error: expect.stringContaining('resolve as duas pendências de uma vez'),
    })
    expect(await phaseOf(project)).toBe(PHASE_2)
  })

  it('concordância baixa não impede o avanço', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    const scene = await seedRound(project, admin, artifacts, {
      roundNumber: 1,
      status: 'closed',
      responses: 3,
    })
    await rate(artifacts, scene, await addActiveEvaluator(ownerDb, project, ana), [
      'low',
      'medium',
      'high',
    ])
    await rate(artifacts, scene, await addActiveEvaluator(ownerDb, project, bruno), [
      'high',
      'low',
      'medium',
    ])

    const agreement = await agreementOf(scene.round)
    expect(agreement).toMatchObject({ calculable: true })
    expect(agreement.calculable ? agreement.alpha : NaN).toBeLessThan(
      AGREEMENT_BANDS.acceptable,
    )

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_3,
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('concordância não calculável não impede o avanço', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    const scene = await seedRound(project, admin, artifacts, {
      roundNumber: 1,
      status: 'closed',
      responses: 3,
    })
    await rate(artifacts, scene, await addActiveEvaluator(ownerDb, project, ana), [
      'low',
      'medium',
      'high',
    ])

    expect(await agreementOf(scene.round)).toMatchObject({
      calculable: false,
      reason: 'few_evaluators',
    })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_3,
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('o Avaliador é recusado, e a fase não muda', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    await seedRound(project, admin, artifacts, { roundNumber: 1, status: 'closed' })
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: expect.stringContaining('administrador'),
    })
    expect(await phaseOf(project)).toBe(PHASE_2)
  })

  it('quem não é membro é recusado com a mesma mensagem, e a fase não muda', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    await seedRound(project, admin, artifacts, { roundNumber: 1, status: 'closed' })
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const asEvaluator = await advancePhase(null, advanceFd(project))
    auth.userId = outsider
    const asOutsider = await advancePhase(null, advanceFd(project))

    expect(asOutsider).toEqual(asEvaluator)
    expect(await phaseOf(project)).toBe(PHASE_2)
  })

  it('o segundo avanço seguido devolve a mensagem de fase errada nomeando a Fase 3', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    await seedRound(project, admin, artifacts, { roundNumber: 1, status: 'closed' })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({ ok: true })
    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: wrongPhaseMessage(PHASE_3),
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('avançar não muda nada além da fase', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    const scene = await seedRound(project, admin, artifacts, {
      roundNumber: 1,
      status: 'closed',
      responses: 2,
    })
    await rate(artifacts, scene, await addActiveEvaluator(ownerDb, project, ana), [
      'low',
      'high',
    ])
    await rate(artifacts, scene, await addActiveEvaluator(ownerDb, project, bruno), [
      'high',
      'low',
    ])

    const before = {
      rounds: await roundStateOf(project),
      evaluations: await evaluationsOf(project),
      usage: await usageOf(project),
    }

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({ ok: true })

    expect(await roundStateOf(project)).toEqual(before.rounds)
    expect(await evaluationsOf(project)).toBe(before.evaluations)
    expect(await usageOf(project)).toEqual(before.usage)
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('o avanço da Fase 1 continua funcionando com o ramo novo no lugar', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_1)
    await addCodebookVersion(ownerDb, project, admin, { definitions: ONE_CELL })
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin)

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_2,
    })
    expect(await phaseOf(project)).toBe(PHASE_2)
  })
})
