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
  saveCodebook,
  savePrompt,
  savePromptMetadata,
} from '@/app/projects/[id]/pipeline/actions'
import { closeRound, createRound } from '@/app/projects/[id]/(tabs)/rounds/actions'
import {
  PHASE_2,
  PHASE_3,
  PHASE_4,
  phase3BlockedMessage,
  wrongPhaseMessage,
} from '@/app/projects/[id]/pipeline/preconditions'
import { loadCodebook, loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { loadPrompt } from '@/app/projects/[id]/pipeline/prompt'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { listRounds } from '@/app/projects/[id]/(tabs)/rounds/rounds'
import type { VersionChange } from '@/app/projects/[id]/(tabs)/rounds/reference-round'
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

type Subject = VersionChange['subject']

describe('app/projects/[id]/pipeline/actions — avanço da Fase 3 para a Fase 4', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function newProject(admin: string, phase = PHASE_3): Promise<string> {
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

  async function seedPhase3Project(admin: string) {
    const project = await newProject(admin)
    const artifacts = await seedArtifacts(project, admin)
    await seedRound(project, admin, artifacts, {
      roundNumber: 1,
      status: 'closed',
      phase: PHASE_2,
    })
    return { project, artifacts }
  }

  async function seedVersions(
    project: string,
    admin: string,
    versionNumber: number,
    subjects: readonly Subject[] = ['codebook', 'prompt'],
  ): Promise<Artifacts> {
    const codebook = subjects.includes('codebook')
      ? await addCodebookVersion(ownerDb, project, admin, {
          versionNumber,
          definitions: ONE_CELL,
        })
      : ''
    const prompt = subjects.includes('prompt')
      ? await addPromptVersion(ownerDb, project, admin, { versionNumber })
      : ''
    if (!codebook) return { codebook, prompt, cells: [] }

    const version = await loadCodebookVersion(project, codebook, ownerDb)
    const cells = resolveCells(version!.definitions, version!.criteria).map((cell) => ({
      definitionId: cell.definition.id,
      criterionId: cell.criterion.id,
    }))
    return { codebook, prompt, cells }
  }

  async function seedReferenceRound(admin: string) {
    const { project, artifacts } = await seedPhase3Project(admin)
    await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
    })
    return { project, artifacts }
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
  ): Promise<void> {
    for (const [index, value] of values.entries()) {
      await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
        cells: artifacts.cells.map((cell) => ({ ...cell, value })),
      })
    }
  }

  function roundStateOf(projectId: string) {
    return listRounds(projectId, ownerDb).then((list) =>
      list.map(({ roundNumber, status, phase, closedAt }) => ({
        roundNumber,
        status,
        phase,
        closedAt,
      })),
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

  it('com uma rodada fechada da Fase 3 e nenhuma aberta, o Administrador avança para a Fase 4', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase3Project(admin)
    await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
    })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_4,
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  it('recusa o avanço com rodada aberta, nomeando a rodada, e a fase não muda', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase3Project(admin)
    await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
    })
    await seedRound(project, admin, artifacts, {
      roundNumber: 3,
      status: 'open',
      phase: PHASE_3,
    })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: phase3BlockedMessage([{ key: 'open_round', roundNumber: 3 }]),
    })
    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: expect.stringContaining('rodada 3'),
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('recusa o avanço sem rodada fechada na Fase 3, mesmo havendo rodadas fechadas da Fase 2', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase3Project(admin)
    await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_2,
    })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: phase3BlockedMessage([{ key: 'no_closed_round' }]),
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('com rodada aberta e nenhuma fechada da Fase 3, a recusa cobre as duas pendências', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase3Project(admin)
    await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'open',
      phase: PHASE_3,
    })

    auth.userId = admin
    const denied = await advancePhase(null, advanceFd(project))
    expect(denied).toEqual({
      error: phase3BlockedMessage([
        { key: 'open_round', roundNumber: 2 },
        { key: 'no_closed_round' },
      ]),
    })
    expect(denied).toEqual({
      error: expect.stringContaining('resolve as duas pendências de uma vez'),
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('concordância baixa não impede o avanço', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const { project, artifacts } = await seedPhase3Project(admin)
    const scene = await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
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

    const agreement = ordinalAlpha(await loadRoundObservations(scene.round, ownerDb))
    expect(agreement).toMatchObject({ calculable: true })
    expect(agreement.calculable ? agreement.alpha : NaN).toBeLessThan(
      AGREEMENT_BANDS.acceptable,
    )

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_4,
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  it('Qualidade concentrada em Baixo não impede o avanço', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const { project, artifacts } = await seedPhase3Project(admin)
    const scene = await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
      responses: 2,
    })
    await rate(artifacts, scene, await addActiveEvaluator(ownerDb, project, ana), [
      'low',
      'low',
    ])
    await rate(artifacts, scene, await addActiveEvaluator(ownerDb, project, bruno), [
      'low',
      'low',
    ])

    const observations = await loadRoundObservations(scene.round, ownerDb)
    const quality = qualityOf(observations)
    expect(quality.rated).toBe(true)
    expect(
      quality.rated ? quality.levels.find((level) => level.value === 'low')?.share : NaN,
    ).toBe(1)
    expect(ordinalAlpha(observations)).toMatchObject({ calculable: false })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_4,
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  it('o Avaliador é recusado, e quem não é membro recebe a mesma mensagem, sem mudar a fase', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const outsider = await newUser('De Fora')
    const { project, artifacts } = await seedPhase3Project(admin)
    await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
    })
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const asEvaluator = await advancePhase(null, advanceFd(project))
    auth.userId = outsider
    const asOutsider = await advancePhase(null, advanceFd(project))

    expect(asEvaluator).toEqual({ error: expect.stringContaining('administrador') })
    expect(asOutsider).toEqual(asEvaluator)
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('o segundo avanço seguido devolve a mensagem de fase errada nomeando a Fase 4', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedPhase3Project(admin)
    await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
    })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({ ok: true })
    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: wrongPhaseMessage(PHASE_4),
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  it('avançar não muda nada além da fase', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const { project, artifacts } = await seedPhase3Project(admin)
    const scene = await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
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
      notifications: await notificationsOf(users),
    }

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({ ok: true })

    expect(await roundStateOf(project)).toEqual(before.rounds)
    expect(await evaluationsOf(project)).toBe(before.evaluations)
    expect(await usageOf(project)).toEqual(before.usage)
    expect(await notificationsOf(users)).toBe(before.notifications)
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  it.each<[string, Subject[]]>([
    ['o codebook mudou', ['codebook']],
    ['o prompt mudou', ['prompt']],
    ['o codebook e o prompt mudaram', ['codebook', 'prompt']],
  ])(
    'recusa o avanço quando %s depois da rodada de referência, e a fase não muda',
    async (_label, subjects) => {
      const admin = await newUser('Admin')
      const { project } = await seedReferenceRound(admin)
      await seedVersions(project, admin, 2, subjects)

      const changes: VersionChange[] = subjects.map((subject) => ({
        subject,
        reference: 1,
        current: 2,
      }))

      auth.userId = admin
      const denied = await advancePhase(null, advanceFd(project))
      expect(denied).toEqual({
        error: phase3BlockedMessage([
          { key: 'versions_changed', referenceRound: 2, changes },
        ]),
      })
      expect(denied).toEqual({ error: expect.stringContaining('rodada 2') })
      expect(denied).toEqual({
        error: expect.stringContaining('Abra e feche mais uma rodada da Fase 3'),
      })
      expect(await phaseOf(project)).toBe(PHASE_3)
    },
  )

  it('com os dois mudados, a recusa nomeia os quatro números de versão', async () => {
    const admin = await newUser('Admin')
    const { project } = await seedReferenceRound(admin)
    await seedVersions(project, admin, 2)

    auth.userId = admin
    const denied = await advancePhase(null, advanceFd(project))
    expect(denied).toEqual({
      error: expect.stringContaining('usou o codebook na versão 1 e o prompt na versão 1'),
    })
    expect(denied).toEqual({
      error: expect.stringContaining('são o codebook na versão 2 e o prompt na versão 2'),
    })
    expect(await phaseOf(project)).toBe(PHASE_3)
  })

  it('com as versões da rodada de referência, concordância baixa e Qualidade em Baixo não impedem o avanço', async () => {
    const admin = await newUser('Admin')
    const ana = await newUser('Ana')
    const bruno = await newUser('Bruno')
    const { project, artifacts } = await seedPhase3Project(admin)
    const scene = await seedRound(project, admin, artifacts, {
      roundNumber: 2,
      status: 'closed',
      phase: PHASE_3,
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

    const [, reference] = await listRounds(project, ownerDb)
    expect(await currentVersionsOf(project)).toEqual({
      codebook: reference.codebookVersionNumber,
      prompt: reference.promptVersionNumber,
    })

    auth.userId = admin
    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_4,
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  it('editar o codebook trava o avanço, e abrir e fechar mais uma rodada da Fase 3 o libera', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedReferenceRound(admin)

    auth.userId = admin
    const codebookForm = new FormData()
    codebookForm.set('project_id', project)
    codebookForm.set('version_id', artifacts.codebook)
    codebookForm.append('definition_title', 'Informacional')
    codebookForm.append('definition_type', 'category')
    codebookForm.append('criterion_scope', '0')
    codebookForm.append('criterion_name', 'Pergunta')
    expect(await saveCodebook(null, codebookForm)).toMatchObject({ ok: true })
    expect(await currentVersionsOf(project)).toEqual({ codebook: 2, prompt: 1 })

    expect(await advancePhase(null, advanceFd(project))).toEqual({
      error: phase3BlockedMessage([
        {
          key: 'versions_changed',
          referenceRound: 2,
          changes: [{ subject: 'codebook', reference: 1, current: 2 }],
        },
      ]),
    })
    expect(await phaseOf(project)).toBe(PHASE_3)

    expect(await createRound(null, advanceFd(project))).toMatchObject({
      ok: true,
      roundNumber: 3,
    })
    const opened = (await listRounds(project, ownerDb)).find(
      (round) => round.roundNumber === 3,
    )!
    expect(opened).toMatchObject({ phase: PHASE_3, codebookVersionNumber: 2 })

    const closeForm = advanceFd(project)
    closeForm.set('round_id', opened.id)
    expect(await closeRound(null, closeForm)).toMatchObject({ ok: true, roundNumber: 3 })

    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_4,
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  it('mudar só os metadados do prompt depois da rodada de referência não impede o avanço', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedReferenceRound(admin)

    auth.userId = admin
    const form = advanceFd(project)
    form.set('version_id', artifacts.prompt)
    form.set('name', 'Classificador de consultas')
    form.set('description', 'Prompt revisado na Fase 3.')
    form.set('change_log', 'Só o nome e a descrição.')
    expect(await savePromptMetadata(null, form)).toMatchObject({ ok: true })

    const prompt = await loadPrompt(project, ownerDb)
    expect(prompt.version).toMatchObject({
      versionNumber: 1,
      name: 'Classificador de consultas',
    })

    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_4,
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  it('salvar o prompt com o mesmo texto não cria versão e não impede o avanço', async () => {
    const admin = await newUser('Admin')
    const { project, artifacts } = await seedReferenceRound(admin)
    const before = await loadPrompt(project, ownerDb)

    auth.userId = admin
    const form = advanceFd(project)
    form.set('version_id', artifacts.prompt)
    form.set('text', before.version!.text)
    expect(await savePrompt(null, form)).toMatchObject({ ok: true })
    expect(await currentVersionsOf(project)).toEqual({ codebook: 1, prompt: 1 })

    expect(await advancePhase(null, advanceFd(project))).toMatchObject({
      ok: true,
      phase: PHASE_4,
    })
    expect(await phaseOf(project)).toBe(PHASE_4)
  })

  describe('a rodada de referência é a última fechada da Fase 3, não a primeira', () => {
    async function seedTwoPhase3Rounds(admin: string) {
      const { project } = await seedReferenceRound(admin)
      const second = await seedVersions(project, admin, 2)
      await seedRound(project, admin, second, {
        roundNumber: 3,
        status: 'closed',
        phase: PHASE_3,
      })
      return project
    }

    it('com as versões da rodada 3 vigentes, avança', async () => {
      const admin = await newUser('Admin')
      const project = await seedTwoPhase3Rounds(admin)
      expect(await currentVersionsOf(project)).toEqual({ codebook: 2, prompt: 2 })

      auth.userId = admin
      expect(await advancePhase(null, advanceFd(project))).toMatchObject({
        ok: true,
        phase: PHASE_4,
      })
      expect(await phaseOf(project)).toBe(PHASE_4)
    })

    it('com um codebook mais novo que o da rodada 3, recusa citando a rodada 3', async () => {
      const admin = await newUser('Admin')
      const project = await seedTwoPhase3Rounds(admin)
      await seedVersions(project, admin, 3, ['codebook'])

      auth.userId = admin
      expect(await advancePhase(null, advanceFd(project))).toEqual({
        error: phase3BlockedMessage([
          {
            key: 'versions_changed',
            referenceRound: 3,
            changes: [{ subject: 'codebook', reference: 2, current: 3 }],
          },
        ]),
      })
      expect(await phaseOf(project)).toBe(PHASE_3)
    })
  })
})
