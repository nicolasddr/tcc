import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

import {
  listEvaluatorEffort,
  loadRoundObservations,
} from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { agreementPair } from '@/app/projects/[id]/(tabs)/rounds/agreement-pair'
import {
  excludedMemberIds,
  loadProjectOutliers,
  loadRoundOutliers,
} from '@/app/projects/[id]/(tabs)/rounds/outliers'
import {
  markOutlier,
  unmarkOutlier,
} from '@/app/projects/[id]/(tabs)/rounds/outlier-actions'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb, projectMembers } from '@/lib/db'
import {
  createUser,
  createProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  addEvaluation,
  addOutlier,
  cleanup,
  type CellFixture,
  type DefinitionFixture,
} from '@/test/helpers'

type Cell = { definitionId: string; criterionId: string }

const ONE_CELL: DefinitionFixture[] = [
  { title: 'Navegacional', type: 'category', criteria: [{ name: 'Clareza' }] },
]

type Scene = { round: string; responses: string[]; cells: Cell[] }

function markForm(
  projectId: string,
  roundId: string,
  projectMemberId: string,
  reason = 'Pontuou tudo no mesmo ponto da escala em toda a rodada.',
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  form.set('round_id', roundId)
  form.set('project_member_id', projectMemberId)
  form.set('reason', reason)
  return form
}

function unmarkForm(projectId: string, roundId: string, markId: string): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  form.set('round_id', roundId)
  form.set('mark_id', markId)
  return form
}

function filled(cells: Cell[], value: CellFixture['value']): CellFixture[] {
  return cells.map((cell) => ({ ...cell, value }))
}

async function pairOf(roundId: string, projectId: string) {
  const observations = await loadRoundObservations(roundId, ownerDb)
  const outliers = await loadProjectOutliers(projectId, ownerDb)
  return agreementPair(observations, outliers.get(roundId) ?? new Set<string>())
}

describe('app/projects/[id]/rounds — a marca de outlier no coeficiente da rodada', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function newProject(admin: string): Promise<string> {
    const project = await createProject(ownerDb, admin, 'Projeto de Teste', {
      phase: PHASE_2,
    })
    projs.push(project)
    return project
  }

  async function newEvaluator(project: string, name: string): Promise<string> {
    return addActiveEvaluator(ownerDb, project, await newUser(name))
  }

  async function seedRound(
    project: string,
    admin: string,
    roundNumber: number,
    responses: number,
  ): Promise<Scene> {
    const codebook = await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: roundNumber,
      definitions: ONE_CELL,
    })
    const prompt = await addPromptVersion(ownerDb, project, admin, {
      versionNumber: roundNumber,
    })
    const round = await addRound(ownerDb, project, admin, codebook, prompt, {
      roundNumber,
      status: 'closed',
    })

    const ids: string[] = []
    for (let index = 0; index < responses; index++) {
      const item = await addInputItem(ownerDb, project, admin, {
        name: `Item ${roundNumber}.${index}`,
      })
      ids.push(await addResponse(ownerDb, round, item, admin))
    }

    const version = await loadCodebookVersion(project, codebook, ownerDb)
    const cells = resolveCells(version!.definitions, version!.criteria).map((cell) => ({
      definitionId: cell.definition.id,
      criterionId: cell.criterion.id,
    }))

    return { round, responses: ids, cells }
  }

  async function rate(
    scene: Scene,
    evaluator: string,
    values: readonly CellFixture['value'][],
  ): Promise<void> {
    for (const [index, value] of values.entries()) {
      await addEvaluation(ownerDb, scene.round, scene.responses[index], evaluator, {
        cells: filled(scene.cells, value),
      })
    }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('a marca muda o cálculo da rodada em que foi feita, e só dela', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const ana = await newEvaluator(project, 'Ana')
    const bruno = await newEvaluator(project, 'Bruno')
    const carla = await newEvaluator(project, 'Carla')

    const first = await seedRound(project, admin, 1, 3)
    const second = await seedRound(project, admin, 2, 3)

    for (const scene of [first, second]) {
      await rate(scene, ana, ['low', 'medium', 'high'])
      await rate(scene, bruno, ['low', 'medium', 'high'])
      await rate(scene, carla, ['high', 'low', 'medium'])
    }

    const before = await pairOf(second.round, project)
    expect(before.withoutOutliers).toBeNull()

    auth.userId = admin
    expect(await markOutlier(null, markForm(project, second.round, carla))).toEqual({
      ok: true,
      nonce: expect.any(Number),
    })

    const marked = await pairOf(second.round, project)
    expect(marked.all).toEqual(before.all)
    expect(marked.excluded).toBe(1)
    expect(marked.withoutOutliers).toMatchObject({ calculable: true, alpha: 1 })
    expect(marked.withoutOutliers).not.toEqual(marked.all)

    const untouched = await pairOf(first.round, project)
    expect(untouched.withoutOutliers).toBeNull()
    expect(untouched.excluded).toBe(0)
    expect(untouched.all).toEqual(before.all)
  })

  it('desmarcar devolve o par ao valor único, e o valor com todos nunca mudou', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const ana = await newEvaluator(project, 'Ana')
    const bruno = await newEvaluator(project, 'Bruno')
    const carla = await newEvaluator(project, 'Carla')

    const scene = await seedRound(project, admin, 1, 3)
    await rate(scene, ana, ['low', 'medium', 'high'])
    await rate(scene, bruno, ['low', 'medium', 'high'])
    await rate(scene, carla, ['high', 'low', 'medium'])

    const before = await pairOf(scene.round, project)

    auth.userId = admin
    await markOutlier(null, markForm(project, scene.round, carla))

    const marked = await pairOf(scene.round, project)
    expect(marked.all).toEqual(before.all)
    expect(marked.withoutOutliers).not.toBeNull()

    const [mark] = await loadRoundOutliers(scene.round, ownerDb)
    expect(await unmarkOutlier(null, unmarkForm(project, scene.round, mark.id))).toEqual(
      { ok: true, nonce: expect.any(Number) },
    )

    const restored = await pairOf(scene.round, project)
    expect(restored.all).toEqual(before.all)
    expect(restored.withoutOutliers).toBeNull()
    expect(restored.excluded).toBe(0)
  })

  it('desativar o avaliador não mexe no coeficiente: tira do progresso e fica no esforço', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const ana = await newEvaluator(project, 'Ana')
    const bruno = await newEvaluator(project, 'Bruno')

    const scene = await seedRound(project, admin, 1, 3)
    await rate(scene, ana, ['low', 'medium', 'high'])
    await rate(scene, bruno, ['low', 'medium', 'high'])

    const before = await pairOf(scene.round, project)
    expect(before.all).toMatchObject({ calculable: true, alpha: 1, raters: 2 })

    await ownerDb
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(eq(projectMembers.id, bruno))

    const after = await pairOf(scene.round, project)
    expect(after).toEqual(before)

    expect(await listEvaluatorEffort(scene.round, project, ownerDb)).toEqual([
      { projectMemberId: ana, name: 'Ana', status: 'active', submitted: 3 },
      { projectMemberId: bruno, name: 'Bruno', status: 'inactive', submitted: 3 },
    ])
  })

  it('o desativado que não avaliou a rodada sai do esforço, e quem avaliou continua', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const ana = await newEvaluator(project, 'Ana')
    const bruno = await newEvaluator(project, 'Bruno')
    const carla = await newEvaluator(project, 'Carla')

    const scene = await seedRound(project, admin, 1, 2)
    await rate(scene, ana, ['low', 'high'])
    await rate(scene, bruno, ['low', 'high'])

    for (const member of [bruno, carla]) {
      await ownerDb
        .update(projectMembers)
        .set({ status: 'inactive' })
        .where(eq(projectMembers.id, member))
    }

    const effort = await listEvaluatorEffort(scene.round, project, ownerDb)

    expect(effort.map((row) => [row.name, row.status, row.submitted])).toEqual([
      ['Ana', 'active', 2],
      ['Bruno', 'inactive', 2],
    ])
  })

  it('o vínculo marcado sai do cálculo mesmo já desativado, e a marca vale por rodada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const ana = await newEvaluator(project, 'Ana')
    const bruno = await newEvaluator(project, 'Bruno')
    const carla = await newEvaluator(project, 'Carla')

    const scene = await seedRound(project, admin, 1, 3)
    await rate(scene, ana, ['low', 'medium', 'high'])
    await rate(scene, bruno, ['low', 'medium', 'high'])
    await rate(scene, carla, ['high', 'low', 'medium'])

    await ownerDb
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(eq(projectMembers.id, carla))

    await addOutlier(ownerDb, scene.round, carla, admin)

    const marks = await loadRoundOutliers(scene.round, ownerDb)
    expect(excludedMemberIds(marks)).toEqual(new Set([carla]))

    const pair = await pairOf(scene.round, project)
    expect(pair.all).toMatchObject({ raters: 3 })
    expect(pair.withoutOutliers).toMatchObject({ calculable: true, alpha: 1, raters: 2 })
  })
})
