import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { asc, desc, eq } from 'drizzle-orm'

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

import { createRound, closeRound } from '@/app/projects/[id]/(tabs)/rounds/actions'
import { listRounds, loadOpenRound } from '@/app/projects/[id]/(tabs)/rounds/rounds'
import { loadRoundObservations } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { codebookLockedMessage } from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { advancePhase, saveCodebook } from '@/app/projects/[id]/pipeline/actions'
import { loadCodebook, loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { PHASE_1, PHASE_2, PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'
import { ordinalAlpha } from '@/lib/agreement'
import {
  ownerDb,
  pgErrorCode,
  codebookVersions,
  codebookDefinitions,
  promptVersions,
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
} from '@/test/helpers'

function newRoundForm(projectId: string): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  return form
}

function closeRoundForm(projectId: string, roundId: string): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  form.set('round_id', roundId)
  return form
}

function codebookForm(
  projectId: string,
  definitions: { title: string; criterion: string }[],
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  definitions.forEach((definition, index) => {
    form.append('definition_title', definition.title)
    form.append('definition_type', 'category')
    form.append('criterion_scope', String(index))
    form.append('criterion_name', definition.criterion)
  })
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
      createdBy: rounds.createdBy,
      createdAt: rounds.createdAt,
      closedAt: rounds.closedAt,
    })
    .from(rounds)
    .where(eq(rounds.projectId, projectId))
    .orderBy(asc(rounds.roundNumber))
}

function codebookVersionsOf(projectId: string) {
  return ownerDb
    .select({
      id: codebookVersions.id,
      versionNumber: codebookVersions.versionNumber,
      usedAt: codebookVersions.usedAt,
    })
    .from(codebookVersions)
    .where(eq(codebookVersions.projectId, projectId))
    .orderBy(desc(codebookVersions.versionNumber))
}

function promptVersionsOf(projectId: string) {
  return ownerDb
    .select({
      id: promptVersions.id,
      versionNumber: promptVersions.versionNumber,
      usedAt: promptVersions.usedAt,
    })
    .from(promptVersions)
    .where(eq(promptVersions.projectId, projectId))
    .orderBy(desc(promptVersions.versionNumber))
}

function titlesOfVersion(versionId: string) {
  return ownerDb
    .select({ title: codebookDefinitions.title })
    .from(codebookDefinitions)
    .where(eq(codebookDefinitions.codebookVersionId, versionId))
    .orderBy(asc(codebookDefinitions.orderIndex))
}

describe('app/projects/[id]/rounds/actions — criar, fechar e travar o codebook', () => {
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

  async function readyProject(
    admin: string,
    phase = PHASE_2,
  ): Promise<{ project: string; codebookVersion: string; promptVersion: string }> {
    const project = await newProject(admin, phase)
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [{ title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] }],
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    return { project, codebookVersion, promptVersion }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('a rodada nasce aberta, com autor, data e número 1', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin)

    auth.userId = admin
    const result = await createRound(null, newRoundForm(project))
    expect(result).toMatchObject({ ok: true, roundNumber: 1 })

    const [round] = await roundsOf(project)
    expect(round.roundNumber).toBe(1)
    expect(round.status).toBe('open')
    expect(round.createdBy).toBe(admin)
    expect(round.createdAt).toBeTruthy()
    expect(round.closedAt).toBeNull()
  })

  it('a criação aponta para as versões vigentes e congela as duas na mesma transação', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)

    const [codebookBefore] = await codebookVersionsOf(project)
    const [promptBefore] = await promptVersionsOf(project)
    expect(codebookBefore.usedAt).toBeNull()
    expect(promptBefore.usedAt).toBeNull()

    auth.userId = admin
    await createRound(null, newRoundForm(project))

    const [round] = await roundsOf(project)
    expect(round.codebookVersionId).toBe(codebookVersion)
    expect(round.promptVersionId).toBe(promptVersion)

    const [codebookAfter] = await codebookVersionsOf(project)
    const [promptAfter] = await promptVersionsOf(project)
    expect(codebookAfter.usedAt).not.toBeNull()
    expect(promptAfter.usedAt).not.toBeNull()
  })

  it('criar rodada na Fase 2 grava a fase 2', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin, PHASE_2)

    auth.userId = admin
    expect(await createRound(null, newRoundForm(project))).toMatchObject({ ok: true })

    const [round] = await roundsOf(project)
    expect(round.phase).toBe(PHASE_2)
  })

  it('criar rodada na Fase 3 grava a fase 3', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin, PHASE_3)

    auth.userId = admin
    expect(await createRound(null, newRoundForm(project))).toMatchObject({ ok: true })

    const [round] = await roundsOf(project)
    expect(round.phase).toBe(PHASE_3)
  })

  it('a fase da rodada não muda quando o projeto avança', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin, PHASE_2)

    auth.userId = admin
    await createRound(null, newRoundForm(project))
    const [created] = await roundsOf(project)
    expect(await closeRound(null, closeRoundForm(project, created.id))).toMatchObject({
      ok: true,
    })

    const advanceForm = new FormData()
    advanceForm.set('project_id', project)
    expect(await advancePhase(null, advanceForm)).toMatchObject({ ok: true, phase: PHASE_3 })

    const [round] = await roundsOf(project)
    expect(round.phase).toBe(PHASE_2)
  })

  it('o banco recusa rodada com fase fora da faixa', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)

    const invalid = addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      phase: PHASE_1,
    })
    await expect(invalid).rejects.toSatisfy(
      (err: unknown) => pgErrorCode(err) === '23514',
    )
  })

  it('a criação com o codebook incompleto é recusada e a mensagem nomeia a definição sem critério', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', type: 'category' },
      ],
    })
    await addPromptVersion(ownerDb, project, admin)

    auth.userId = admin
    const result = await createRound(null, newRoundForm(project))
    expect(result).toMatchObject({ error: expect.stringContaining('“Transacional”') })
    expect(await roundsOf(project)).toHaveLength(0)

    const [codebook] = await codebookVersionsOf(project)
    expect(codebook.usedAt).toBeNull()
  })

  it('a criação sem nenhuma definição é recusada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin)

    auth.userId = admin
    const result = await createRound(null, newRoundForm(project))
    expect(result).toMatchObject({ error: expect.stringContaining('nenhuma definição') })
    expect(await roundsOf(project)).toHaveLength(0)
  })

  it('a criação na Fase 1 é recusada', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin, PHASE_1)

    auth.userId = admin
    const result = await createRound(null, newRoundForm(project))
    expect(result).toMatchObject({ error: expect.stringContaining(`Fase ${PHASE_2}`) })
    expect(await roundsOf(project)).toHaveLength(0)
  })

  it('criar uma segunda rodada com uma aberta é recusado', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
    })

    auth.userId = admin
    const result = await createRound(null, newRoundForm(project))
    expect(result).toMatchObject({ error: expect.stringContaining('rodada 1') })
    expect(await roundsOf(project)).toHaveLength(1)
  })

  it('o índice único parcial recusa a segunda rodada aberta mesmo por fora da action', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
    })

    const duplicate = addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 2 },
    )
    await expect(duplicate).rejects.toSatisfy(
      (err: unknown) => pgErrorCode(err) === '23505',
    )
  })

  it('depois de fechar, a rodada seguinte recebe o número seguinte', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const first = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1, status: 'closed' },
    )

    auth.userId = admin
    const result = await createRound(null, newRoundForm(project))
    expect(result).toMatchObject({ ok: true, roundNumber: 2 })

    const list = await roundsOf(project)
    expect(list.map((round) => round.roundNumber)).toEqual([1, 2])
    expect(list.find((round) => round.id === first)!.status).toBe('closed')
  })

  it.each([PHASE_2, PHASE_3])(
    'na Fase %i, com rodada aberta, salvar o codebook é recusado e nada muda',
    async (phase) => {
      const admin = await newUser('Admin')
      const { project, codebookVersion, promptVersion } = await readyProject(admin, phase)
      await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
        roundNumber: 1,
        phase,
      })

      auth.userId = admin
      const result = await saveCodebook(
        null,
        codebookForm(project, [{ title: 'Outra', criterion: 'Clareza' }]),
      )
      expect(result).toEqual({ error: codebookLockedMessage(1) })

      expect(await codebookVersionsOf(project)).toHaveLength(1)
      expect((await titlesOfVersion(codebookVersion)).map((d) => d.title)).toEqual([
        'Informacional',
      ])
    },
  )

  it.each([PHASE_2, PHASE_3])(
    'na Fase %i, fechar destrava o codebook, e o salvamento seguinte cria a versão seguinte',
    async (phase) => {
      const admin = await newUser('Admin')
      const { project, codebookVersion, promptVersion } = await readyProject(admin, phase)

      auth.userId = admin
      await createRound(null, newRoundForm(project))

      const open = await loadOpenRound(project)
      expect(open).not.toBeNull()

      const closed = await closeRound(null, closeRoundForm(project, open!.id))
      expect(closed).toMatchObject({ ok: true, roundNumber: 1 })

      const saved = await saveCodebook(
        null,
        codebookForm(project, [{ title: 'Informacional revisada', criterion: 'Clareza' }]),
      )
      expect(saved).toMatchObject({ ok: true })

      const versions = await codebookVersionsOf(project)
      expect(versions.map((version) => version.versionNumber)).toEqual([2, 1])
      expect(versions.find((version) => version.id === codebookVersion)!.usedAt).not.toBeNull()

      const codebook = await loadCodebook(project)
      expect(codebook.version!.versionNumber).toBe(2)
      expect(codebook.definitions.map((d) => d.title)).toEqual(['Informacional revisada'])
      expect((await titlesOfVersion(codebookVersion)).map((d) => d.title)).toEqual([
        'Informacional',
      ])
      const [round] = await roundsOf(project)
      expect(round).toMatchObject({ phase, codebookVersionId: codebookVersion })
      expect(promptVersion).toBeTruthy()
    },
  )

  it('fechar registra a data e não depende de nenhum avaliador ter terminado', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Bia Avaliadora')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )

    auth.userId = admin
    expect(await closeRound(null, closeRoundForm(project, round))).toMatchObject({
      ok: true,
    })

    const [row] = await roundsOf(project)
    expect(row.status).toBe('closed')
    expect(row.closedAt).not.toBeNull()
    expect(await loadOpenRound(project)).toBeNull()
  })

  it('fechar não olha métrica: a rodada com ICR não calculável fecha igual', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Bia Avaliadora')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const member = await addActiveEvaluator(ownerDb, project, evaluator)
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )
    const item = await addInputItem(ownerDb, project, admin)
    const response = await addResponse(ownerDb, round, item, admin)

    const codebook = await loadCodebookVersion(project, codebookVersion)
    await addEvaluation(ownerDb, round, response, member, {
      cells: resolveCells(codebook!.definitions, codebook!.criteria).map((cell) => ({
        definitionId: cell.definition.id,
        criterionId: cell.criterion.id,
        value: 'high' as const,
      })),
    })

    expect(ordinalAlpha(await loadRoundObservations(round))).toMatchObject({
      calculable: false,
      reason: 'few_evaluators',
    })

    auth.userId = admin
    expect(await closeRound(null, closeRoundForm(project, round))).toMatchObject({
      ok: true,
    })

    const [row] = await roundsOf(project)
    expect(row.status).toBe('closed')
  })

  it('fechar duas vezes é recusado', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )

    auth.userId = admin
    await closeRound(null, closeRoundForm(project, round))
    const [first] = await roundsOf(project)

    const second = await closeRound(null, closeRoundForm(project, round))
    expect(second).toMatchObject({
      error: expect.stringContaining('já foi fechada'),
    })

    const [after] = await roundsOf(project)
    expect(after.closedAt).toBe(first.closedAt)
  })

  it('fechar uma rodada de outro projeto é recusado', async () => {
    const admin = await newUser('Admin')
    const other = await readyProject(admin)
    const mine = await readyProject(admin)
    const round = await addRound(
      ownerDb,
      other.project,
      admin,
      other.codebookVersion,
      other.promptVersion,
      { roundNumber: 1 },
    )

    auth.userId = admin
    const result = await closeRound(null, closeRoundForm(mine.project, round))
    expect(result).toMatchObject({ error: expect.stringContaining('não existe mais') })
    expect((await roundsOf(other.project))[0].status).toBe('open')
  })

  it('a lista traz número, estado, fase, versões usadas e datas, em ordem cronológica', async () => {
    const admin = await newUser('Ana Pesquisadora')
    const { project, codebookVersion, promptVersion } = await readyProject(admin, PHASE_3)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
      status: 'closed',
      phase: PHASE_2,
    })
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 2,
      phase: PHASE_3,
    })

    const list = await listRounds(project)
    expect(list.map((round) => round.roundNumber)).toEqual([1, 2])
    expect(list.map((round) => round.status)).toEqual(['closed', 'open'])
    expect(list.map((round) => round.phase)).toEqual([PHASE_2, PHASE_3])
    expect(list[1]).toMatchObject({
      authorName: 'Ana Pesquisadora',
      codebookVersionNumber: 1,
      promptVersionNumber: 1,
    })
    expect(list[0].closedAt).not.toBeNull()
    expect(list[1].closedAt).toBeNull()
    expect(list[1].createdAt).toBeTruthy()
  })

  it('o avaliador é barrado em criar rodada', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const { project } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const result = await createRound(null, newRoundForm(project))
    expect(result).toMatchObject({
      error: expect.stringContaining('Apenas o administrador'),
    })
    expect(await roundsOf(project)).toHaveLength(0)
  })

  it('o avaliador é barrado em fechar rodada', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )

    auth.userId = evaluator
    const result = await closeRound(null, closeRoundForm(project, round))
    expect(result).toMatchObject({
      error: expect.stringContaining('Apenas o administrador'),
    })
    expect((await roundsOf(project))[0].status).toBe('open')
  })

  it('quem não é membro do projeto é barrado nas duas ações', async () => {
    const admin = await newUser('Admin')
    const stranger = await newUser('Estranho')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )

    auth.userId = stranger
    expect(await createRound(null, newRoundForm(project))).toMatchObject({
      error: expect.stringContaining('Apenas o administrador'),
    })
    expect(await closeRound(null, closeRoundForm(project, round))).toMatchObject({
      error: expect.stringContaining('Apenas o administrador'),
    })
    expect(await roundsOf(project)).toHaveLength(1)
  })
})
