import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { asc, count, eq, inArray } from 'drizzle-orm'

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

import {
  advancePhase,
  returnToPhase3,
  saveCodebook,
  savePrompt,
} from '@/app/projects/[id]/pipeline/actions'
import {
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
  phase3BlockedMessage,
  returnBlockedMessage,
  returnWrongPhaseMessage,
} from '@/app/projects/[id]/pipeline/preconditions'
import { frozenMessage } from '@/app/projects/[id]/pipeline/freeze'
import { loadCodebook, loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { loadPrompt } from '@/app/projects/[id]/pipeline/prompt'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { listRounds } from '@/app/projects/[id]/(tabs)/rounds/rounds'
import { projectReferenceRound } from '@/app/projects/[id]/(tabs)/rounds/reference-round'
import { loadRoundObservations } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { AGREEMENT_BANDS } from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { qualityOf } from '@/app/projects/[id]/(tabs)/rounds/quality'
import { ordinalAlpha } from '@/lib/agreement'
import {
  ownerDb,
  projects,
  codebookVersions,
  promptVersions,
  evaluations,
  scores,
  roundOutliers,
  consensusNotes,
  notifications,
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
  addOutlier,
  addConsensusNote,
  cleanup,
  type CellFixture,
  type DefinitionFixture,
} from '@/test/helpers'

const ONE_CELL: DefinitionFixture[] = [
  { title: 'Navegacional', type: 'category', criteria: [{ name: 'Clareza' }] },
]

const FROZEN = '2026-01-01T12:00:00.000Z'

const RETURN_DENIED =
  'Não foi possível voltar de fase. Apenas o administrador do projeto pode fazê-lo.'

type Cell = { definitionId: string; criterionId: string }

type Artifacts = { codebook: string; prompt: string; cells: Cell[] }

type Scene = { round: string; responses: string[] }

describe('app/projects/[id]/pipeline/actions — retorno da Fase 4 para a Fase 3', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function newProject(admin: string, phase = PHASE_4): Promise<string> {
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

  function projectFd(projectId: string): FormData {
    const form = new FormData()
    form.set('project_id', projectId)
    return form
  }

  function codebookForm(projectId: string, versionId: string): FormData {
    const form = projectFd(projectId)
    form.set('version_id', versionId)
    form.append('definition_title', 'Informacional')
    form.append('definition_type', 'category')
    form.append('criterion_scope', '0')
    form.append('criterion_name', 'Pergunta')
    return form
  }

  function promptForm(projectId: string, versionId: string, text: string): FormData {
    const form = projectFd(projectId)
    form.set('version_id', versionId)
    form.set('text', text)
    return form
  }

  async function cellsOf(project: string, codebook: string): Promise<Cell[]> {
    const version = await loadCodebookVersion(project, codebook, ownerDb)
    return resolveCells(version!.definitions, version!.criteria).map((cell) => ({
      definitionId: cell.definition.id,
      criterionId: cell.criterion.id,
    }))
  }

  async function seedRound(
    project: string,
    admin: string,
    artifacts: Artifacts,
    opts: {
      roundNumber: number
      status: 'open' | 'closed'
      phase: number
      responses?: number
    },
  ): Promise<Scene> {
    const round = await addRound(
      ownerDb,
      project,
      admin,
      artifacts.codebook,
      artifacts.prompt,
      { roundNumber: opts.roundNumber, status: opts.status, phase: opts.phase },
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

  async function seedPhase4Project(admin: string) {
    const project = await newProject(admin)
    const codebook = await addCodebookVersion(ownerDb, project, admin, {
      definitions: ONE_CELL,
      usedAt: FROZEN,
    })
    const prompt = await addPromptVersion(ownerDb, project, admin, { usedAt: FROZEN })
    const artifacts = { codebook, prompt, cells: await cellsOf(project, codebook) }

    await seedRound(project, admin, artifacts, {
      roundNumber: 1,
      status: 'closed',
      phase: PHASE_2,
    })
    await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
    })
    return { project, artifacts }
  }

  async function seedPhase4Rounds(project: string, admin: string, artifacts: Artifacts) {
    await seedRound(project, admin, artifacts, {
      roundNumber: 3,
      status: 'closed',
      phase: PHASE_4,
    })
    await seedRound(project, admin, artifacts, {
      roundNumber: 4,
      status: 'closed',
      phase: PHASE_4,
    })
  }

  async function currentVersionsOf(projectId: string) {
    const codebook = await loadCodebook(projectId, ownerDb)
    const prompt = await loadPrompt(projectId, ownerDb)
    return {
      codebook: codebook.version?.versionNumber ?? null,
      prompt: prompt.version?.versionNumber ?? null,
    }
  }

  async function rate(
    artifacts: Artifacts,
    scene: Scene,
    evaluator: string,
    values: readonly CellFixture['value'][],
  ): Promise<string[]> {
    const ids: string[] = []
    for (const [index, value] of values.entries()) {
      ids.push(
        await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
          cells: artifacts.cells.map((cell) => ({ ...cell, value })),
        }),
      )
    }
    return ids
  }

  async function evaluationsOf(projectId: string): Promise<number> {
    const [row] = await ownerDb
      .select({ value: count() })
      .from(evaluations)
      .innerJoin(rounds, eq(rounds.id, evaluations.roundId))
      .where(eq(rounds.projectId, projectId))
    return row.value
  }

  async function scoresOf(projectId: string) {
    return ownerDb
      .select({ id: scores.id, value: scores.value, justification: scores.justification })
      .from(scores)
      .innerJoin(evaluations, eq(evaluations.id, scores.evaluationId))
      .innerJoin(rounds, eq(rounds.id, evaluations.roundId))
      .where(eq(rounds.projectId, projectId))
      .orderBy(asc(scores.id))
  }

  async function outliersOf(projectId: string) {
    return ownerDb
      .select({
        id: roundOutliers.id,
        roundId: roundOutliers.roundId,
        projectMemberId: roundOutliers.projectMemberId,
        reason: roundOutliers.reason,
        removedAt: roundOutliers.removedAt,
      })
      .from(roundOutliers)
      .innerJoin(rounds, eq(rounds.id, roundOutliers.roundId))
      .where(eq(rounds.projectId, projectId))
      .orderBy(asc(roundOutliers.id))
  }

  async function consensusNotesOf(projectId: string) {
    return ownerDb
      .select({
        id: consensusNotes.id,
        roundId: consensusNotes.roundId,
        visibility: consensusNotes.visibility,
        text: consensusNotes.text,
        updatedAt: consensusNotes.updatedAt,
      })
      .from(consensusNotes)
      .innerJoin(rounds, eq(rounds.id, consensusNotes.roundId))
      .where(eq(rounds.projectId, projectId))
      .orderBy(asc(consensusNotes.id))
  }

  async function notificationsOf(userIds: string[]): Promise<number> {
    const [row] = await ownerDb
      .select({ value: count() })
      .from(notifications)
      .where(inArray(notifications.userId, userIds))
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

  it('sem nenhuma rodada da Fase 4, o Administrador volta para a Fase 3', async () => {
    const admin = await newUser('Admin')
    const { project } = await seedPhase4Project(admin)

    auth.userId = admin
    expect(await returnToPhase3(null, projectFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_3,
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('recusa o retorno com rodada aberta, nomeando a rodada, e nada muda', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase4Project(admin)
    await seedRound(project, admin, artifacts, {
      roundNumber: 3,
      status: 'open',
      phase: PHASE_4,
    })

    auth.userId = admin
    const denied = await returnToPhase3(null, projectFd(project))
    expect(denied).toEqual({
      error: returnBlockedMessage([{ key: 'open_round', roundNumber: 3 }]),
    })
    expect(denied).toEqual({ error: expect.stringContaining('rodada 3') })
    expect(await phaseOf(project)).toBe(PHASE_4)
    expect((await listRounds(project, ownerDb)).find((r) => r.roundNumber === 3)).toMatchObject({
      status: 'open',
      phase: PHASE_4,
      closedAt: null,
    })
  })

  it('depois de rodadas fechadas da Fase 4, volta e não muda nada além da fase', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const { project, artifacts } = await seedPhase4Project(admin)
    const anaMember = await addActiveEvaluator(ownerDb, project, ana)
    const brunoMember = await addActiveEvaluator(ownerDb, project, bruno)

    const third = await seedRound(project, admin, artifacts, {
      roundNumber: 3,
      status: 'closed',
      phase: PHASE_4,
      responses: 2,
    })
    const fourth = await seedRound(project, admin, artifacts, {
      roundNumber: 4,
      status: 'closed',
      phase: PHASE_4,
      responses: 2,
    })
    for (const scene of [third, fourth]) {
      await rate(artifacts, scene, anaMember, ['low', 'high'])
      await rate(artifacts, scene, brunoMember, ['high', 'medium'])
    }
    await addOutlier(ownerDb, third.round, brunoMember, admin, {
      reason: 'Notas sem relação com o codebook.',
    })
    await addConsensusNote(ownerDb, {
      roundId: fourth.round,
      responseId: fourth.responses[0],
      ...artifacts.cells[0],
      projectMemberId: anaMember,
      visibility: 'shared',
      text: 'A resposta cita o site pelo nome.',
    })

    const before = {
      rounds: await listRounds(project, ownerDb),
      evaluations: await evaluationsOf(project),
      scores: await scoresOf(project),
      outliers: await outliersOf(project),
      consensusNotes: await consensusNotesOf(project),
      usage: await usageOf(project),
      versions: await currentVersionsOf(project),
      notifications: await notificationsOf(users),
    }
    expect(before.rounds.map((round) => round.phase)).toEqual([
      PHASE_2,
      PHASE_3,
      PHASE_4,
      PHASE_4,
    ])
    expect(before.evaluations).toBe(8)
    expect(before.outliers).toHaveLength(1)
    expect(before.consensusNotes).toHaveLength(1)

    auth.userId = admin
    expect(await returnToPhase3(null, projectFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_3,
    })

    expect(await listRounds(project, ownerDb)).toEqual(before.rounds)
    expect(await evaluationsOf(project)).toBe(before.evaluations)
    expect(await scoresOf(project)).toEqual(before.scores)
    expect(await outliersOf(project)).toEqual(before.outliers)
    expect(await consensusNotesOf(project)).toEqual(before.consensusNotes)
    expect(await usageOf(project)).toEqual(before.usage)
    expect(await currentVersionsOf(project)).toEqual(before.versions)
    expect(await notificationsOf(users)).toBe(before.notifications)
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('concordância baixa e Qualidade concentrada em Baixo na rodada da Fase 4 não impedem o retorno', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const { project, artifacts } = await seedPhase4Project(admin)
    const scene = await seedRound(project, admin, artifacts, {
      roundNumber: 3,
      status: 'closed',
      phase: PHASE_4,
      responses: 4,
    })
    await rate(artifacts, scene, await addActiveEvaluator(ownerDb, project, ana), [
      'low',
      'low',
      'low',
      'high',
    ])
    await rate(artifacts, scene, await addActiveEvaluator(ownerDb, project, bruno), [
      'low',
      'low',
      'high',
      'low',
    ])

    const observations = await loadRoundObservations(scene.round, ownerDb)
    const agreement = ordinalAlpha(observations)
    expect(agreement).toMatchObject({ calculable: true })
    expect(agreement.calculable ? agreement.alpha : NaN).toBeLessThan(
      AGREEMENT_BANDS.acceptable,
    )
    const quality = qualityOf(observations)
    expect(
      quality.rated ? quality.levels.find((level) => level.value === 'low')?.share : NaN,
    ).toBe(0.75)

    auth.userId = admin
    expect(await returnToPhase3(null, projectFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_3,
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('o segundo retorno seguido devolve a mensagem de fase errada nomeando a Fase 3', async () => {
    const admin = await newUser('Admin')
    const { project } = await seedPhase4Project(admin)

    auth.userId = admin
    expect(await returnToPhase3(null, projectFd(project))).toMatchObject({ ok: true })
    expect(await returnToPhase3(null, projectFd(project))).toEqual({
      error: returnWrongPhaseMessage(PHASE_3),
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it.each([PHASE_1, PHASE_2])(
    'na Fase %i o retorno devolve a mensagem de fase errada, sem mudar a fase',
    async (phase) => {
      const admin = await newUser('Admin')
      const project = await newProject(admin, phase)

      auth.userId = admin
      expect(await returnToPhase3(null, projectFd(project))).toEqual({
        error: returnWrongPhaseMessage(phase),
      })
      expect(await phaseOf(project)).toBe(phase)
    },
  )

  it('o Avaliador é recusado, e quem não é membro recebe a mesma mensagem, sem mudar a fase', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const outsider = await newUser('De Fora')
    const { project } = await seedPhase4Project(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const asEvaluator = await returnToPhase3(null, projectFd(project))
    auth.userId = outsider
    const asOutsider = await returnToPhase3(null, projectFd(project))

    expect(asEvaluator).toEqual({ error: RETURN_DENIED })
    expect(asOutsider).toEqual(asEvaluator)
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  it('o retorno não notifica ninguém', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const { project, artifacts } = await seedPhase4Project(admin)
    await addActiveEvaluator(ownerDb, project, ana)
    await addActiveEvaluator(ownerDb, project, bruno)
    await seedPhase4Rounds(project, admin, artifacts)
    const before = await notificationsOf([admin, ana, bruno])

    auth.userId = admin
    expect(await returnToPhase3(null, projectFd(project))).toMatchObject({ ok: true })
    expect(await notificationsOf([admin, ana, bruno])).toBe(before)
  })

  it('na Fase 4 o codebook é recusado, e depois do retorno salvá-lo cria a versão seguinte', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase4Project(admin)
    await seedPhase4Rounds(project, admin, artifacts)
    const v1 = await loadCodebookVersion(project, artifacts.codebook, ownerDb)

    auth.userId = admin
    expect(await saveCodebook(null, codebookForm(project, artifacts.codebook))).toEqual({
      error: frozenMessage('codebook'),
    })
    expect(await currentVersionsOf(project)).toEqual({ codebook: 1, prompt: 1 })

    expect(await returnToPhase3(null, projectFd(project))).toMatchObject({ ok: true })
    expect(await saveCodebook(null, codebookForm(project, artifacts.codebook))).toMatchObject({
      ok: true,
    })

    expect(await currentVersionsOf(project)).toEqual({ codebook: 2, prompt: 1 })
    const first = await loadCodebookVersion(project, artifacts.codebook, ownerDb)
    expect(first).toMatchObject({
      definitions: v1!.definitions,
      criteria: v1!.criteria,
      version: { versionNumber: 1, usedAt: v1!.version.usedAt },
    })
    const current = await loadCodebook(project, ownerDb)
    expect(current.definitions.map((definition) => definition.title)).toEqual([
      'Informacional',
    ])
  })

  it('na Fase 4 o prompt é recusado, e depois do retorno salvar o texto cria a versão seguinte', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase4Project(admin)
    await seedPhase4Rounds(project, admin, artifacts)
    const v1 = await loadPrompt(project, ownerDb)
    const text = 'Classifique a consulta abaixo em uma das definições do codebook.'

    auth.userId = admin
    expect(await savePrompt(null, promptForm(project, artifacts.prompt, text))).toEqual({
      error: frozenMessage('prompt'),
    })
    expect(await currentVersionsOf(project)).toEqual({ codebook: 1, prompt: 1 })

    expect(await returnToPhase3(null, projectFd(project))).toMatchObject({ ok: true })
    expect(await savePrompt(null, promptForm(project, artifacts.prompt, text))).toMatchObject({
      ok: true,
    })

    expect(await currentVersionsOf(project)).toEqual({ codebook: 1, prompt: 2 })
    expect((await loadPrompt(project, ownerDb)).version).toMatchObject({
      versionNumber: 2,
      text,
    })
    const [first] = await ownerDb
      .select({ text: promptVersions.text, usedAt: promptVersions.usedAt })
      .from(promptVersions)
      .where(eq(promptVersions.id, artifacts.prompt))
    expect(first).toEqual({ text: v1.version!.text, usedAt: v1.version!.usedAt })
  })

  it('voltar e avançar de novo sem editar é permitido, com a mesma rodada de referência', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase4Project(admin)
    await seedPhase4Rounds(project, admin, artifacts)
    expect(projectReferenceRound(await listRounds(project, ownerDb))).toMatchObject({
      roundNumber: 2,
    })

    auth.userId = admin
    expect(await returnToPhase3(null, projectFd(project))).toMatchObject({ ok: true })
    expect(await advancePhase(null, projectFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_4,
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
    expect(projectReferenceRound(await listRounds(project, ownerDb))).toMatchObject({
      roundNumber: 2,
    })
  })

  it('voltar e editar o codebook trava o novo avanço pela rodada de referência, e uma rodada da Fase 3 com a versão nova o libera', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase4Project(admin)
    await seedPhase4Rounds(project, admin, artifacts)

    auth.userId = admin
    expect(await returnToPhase3(null, projectFd(project))).toMatchObject({ ok: true })
    expect(await saveCodebook(null, codebookForm(project, artifacts.codebook))).toMatchObject({
      ok: true,
    })

    expect(await advancePhase(null, projectFd(project))).toEqual({
      error: phase3BlockedMessage([
        {
          key: 'versions_changed',
          referenceRound: 2,
          changes: [{ subject: 'codebook', reference: 1, current: 2 }],
        },
      ]),
    })
    expect(await phaseOf(project)).toBe(PHASE_3)

    const edited = (await loadCodebook(project, ownerDb)).version!
    await seedRound(
      project,
      admin,
      { ...artifacts, codebook: edited.id },
      { roundNumber: 5, status: 'closed', phase: PHASE_3 },
    )

    expect(await advancePhase(null, projectFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_4,
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
    expect(projectReferenceRound(await listRounds(project, ownerDb))).toMatchObject({
      roundNumber: 5,
    })
  })
})
