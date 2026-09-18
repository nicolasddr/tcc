// app/projects/[id]/(tabs)/rounds/outlier-actions.int.test.ts — a porta única da
// exclusão (issue #65, Parte 2): quem pode marcar, o que a marca exige e o que
// desmarcar preserva.
//
// As actions abrem a própria transação e COMMITAM, então as fixtures vão por `ownerDb`
// e saem no `cleanup()` — não dá para rodar sob rollback.
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { asc, eq } from 'drizzle-orm'

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
  markOutlier,
  unmarkOutlier,
} from '@/app/projects/[id]/(tabs)/rounds/outlier-actions'
import {
  loadOutlierHistory,
  loadRoundOutliers,
} from '@/app/projects/[id]/(tabs)/rounds/outliers'
import { PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { OUTLIER_REASON_MAX } from '@/lib/limits'
import { ownerDb, projectMembers, roundOutliers } from '@/lib/db'
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

function markForm(
  projectId: string,
  roundId: string,
  projectMemberId: string,
  reason = 'Avaliou antes do treinamento desta rodada.',
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

function marksOf(roundId: string) {
  return ownerDb
    .select({
      id: roundOutliers.id,
      projectMemberId: roundOutliers.projectMemberId,
      reason: roundOutliers.reason,
      markedBy: roundOutliers.markedBy,
      markedAt: roundOutliers.markedAt,
      removedBy: roundOutliers.removedBy,
      removedAt: roundOutliers.removedAt,
    })
    .from(roundOutliers)
    .where(eq(roundOutliers.roundId, roundId))
    .orderBy(asc(roundOutliers.markedAt))
}

describe('app/projects/[id]/rounds/outlier-actions — marcar e desmarcar outlier', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  type Scenario = {
    admin: string
    project: string
    round: string
    response: string
    evaluator: string
    evaluatorUser: string
  }

  async function scenario(roundNumber = 1): Promise<Scenario> {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: PHASE_2,
    })
    projs.push(project)

    const evaluatorUser = await newUser('Ana')
    const evaluator = await addActiveEvaluator(ownerDb, project, evaluatorUser)

    const codebook = await addCodebookVersion(ownerDb, project, admin)
    const prompt = await addPromptVersion(ownerDb, project, admin)
    const item = await addInputItem(ownerDb, project, admin)
    const round = await addRound(ownerDb, project, admin, codebook, prompt, {
      roundNumber,
    })
    const response = await addResponse(ownerDb, round, item, admin)
    await addEvaluation(ownerDb, round, response, evaluator)

    return { admin, project, round, response, evaluator, evaluatorUser }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('só o administrador marca: o avaliador e quem não é membro são barrados e nada é gravado', async () => {
    const s = await scenario()
    const outsider = await newUser('De Fora')

    for (const caller of [s.evaluatorUser, outsider]) {
      auth.userId = caller
      const result = await markOutlier(null, markForm(s.project, s.round, s.evaluator))
      expect(result).toMatchObject({
        error: expect.stringContaining('administrador do projeto'),
      })
    }

    expect(await marksOf(s.round)).toHaveLength(0)
  })

  it('só o administrador desmarca: o avaliador e quem não é membro são barrados e a marca continua ativa', async () => {
    const s = await scenario()
    const outsider = await newUser('De Fora')

    auth.userId = s.admin
    await markOutlier(null, markForm(s.project, s.round, s.evaluator))
    const [mark] = await marksOf(s.round)

    for (const caller of [s.evaluatorUser, outsider]) {
      auth.userId = caller
      const result = await unmarkOutlier(null, unmarkForm(s.project, s.round, mark.id))
      expect(result).toMatchObject({
        error: expect.stringContaining('administrador do projeto'),
      })
    }

    const [untouched] = await marksOf(s.round)
    expect(untouched.removedAt).toBeNull()
    expect(untouched.removedBy).toBeNull()
  })

  it('a justificativa é obrigatória: vazia, em branco ou acima do teto é recusada e nada é gravado', async () => {
    const s = await scenario()
    auth.userId = s.admin

    const vazia = await markOutlier(null, markForm(s.project, s.round, s.evaluator, ''))
    const branca = await markOutlier(
      null,
      markForm(s.project, s.round, s.evaluator, '   \n  '),
    )
    const longa = await markOutlier(
      null,
      markForm(s.project, s.round, s.evaluator, 'x'.repeat(OUTLIER_REASON_MAX + 1)),
    )

    expect(vazia).toMatchObject({ error: expect.stringContaining('decisão de método') })
    expect(branca).toMatchObject({ error: expect.stringContaining('decisão de método') })
    expect(longa).toMatchObject({
      error: expect.stringContaining(String(OUTLIER_REASON_MAX)),
    })
    expect(await marksOf(s.round)).toHaveLength(0)
  })

  it('marcar grava autor, data e a justificativa com trim', async () => {
    const s = await scenario()
    auth.userId = s.admin

    const result = await markOutlier(
      null,
      markForm(s.project, s.round, s.evaluator, '  Destoou do grupo em todas as células.  '),
    )
    expect(result).toMatchObject({ ok: true })

    const [mark] = await marksOf(s.round)
    expect(mark.projectMemberId).toBe(s.evaluator)
    expect(mark.reason).toBe('Destoou do grupo em todas as células.')
    expect(mark.markedBy).toBe(s.admin)
    expect(mark.markedAt).toBeTruthy()
    expect(mark.removedAt).toBeNull()

    const [active] = await loadRoundOutliers(s.round)
    expect(active.evaluatorName).toBe('Ana')
    expect(active.markedByName).toBe('Admin')
  })

  it('só se marca quem avaliou naquela rodada', async () => {
    const s = await scenario()
    const semNota = await addActiveEvaluator(ownerDb, s.project, await newUser('Bruno'))

    auth.userId = s.admin
    const result = await markOutlier(null, markForm(s.project, s.round, semNota))

    expect(result).toMatchObject({
      error: expect.stringContaining('não enviou nenhuma avaliação nesta rodada'),
    })
    expect(await marksOf(s.round)).toHaveLength(0)
  })

  it('a rodada e o vínculo têm que ser deste projeto', async () => {
    const s = await scenario()
    const outro = await scenario()

    auth.userId = s.admin
    const rodadaDeOutro = await markOutlier(
      null,
      markForm(s.project, outro.round, s.evaluator),
    )
    const vinculoDeOutro = await markOutlier(
      null,
      markForm(s.project, s.round, outro.evaluator),
    )

    expect(rodadaDeOutro).toMatchObject({
      error: expect.stringContaining('não existe mais neste projeto'),
    })
    expect(vinculoDeOutro).toMatchObject({
      error: expect.stringContaining('não participa deste projeto'),
    })
    expect(await marksOf(s.round)).toHaveLength(0)
    expect(await marksOf(outro.round)).toHaveLength(0)
  })

  it('marcar a mesma pessoa duas vezes na mesma rodada devolve a mensagem de corrida', async () => {
    const s = await scenario()
    auth.userId = s.admin

    await markOutlier(null, markForm(s.project, s.round, s.evaluator))
    const segunda = await markOutlier(
      null,
      markForm(s.project, s.round, s.evaluator, 'Outra razão.'),
    )

    expect(segunda).toMatchObject({ error: expect.stringContaining('Recarregue a página') })
    expect(await marksOf(s.round)).toHaveLength(1)
  })

  it('desmarcar grava autor e data, preserva a linha, e a segunda vez é recusada', async () => {
    const s = await scenario()
    const outroAdmin = await newUser('Outro Admin')
    await ownerDb.insert(projectMembers).values({
      projectId: s.project,
      userId: outroAdmin,
      role: 'administrator',
      status: 'active',
    })

    auth.userId = s.admin
    await markOutlier(null, markForm(s.project, s.round, s.evaluator))
    const [mark] = await marksOf(s.round)

    auth.userId = outroAdmin
    const primeira = await unmarkOutlier(null, unmarkForm(s.project, s.round, mark.id))
    expect(primeira).toMatchObject({ ok: true })

    const [removida] = await marksOf(s.round)
    expect(removida.id).toBe(mark.id)
    expect(removida.reason).toBe(mark.reason)
    expect(removida.markedBy).toBe(s.admin)
    expect(removida.removedBy).toBe(outroAdmin)
    expect(removida.removedAt).toBeTruthy()

    expect(await loadRoundOutliers(s.round)).toEqual([])
    const history = await loadOutlierHistory(s.round)
    expect(history).toHaveLength(1)
    expect(history[0].removedByName).toBe('Outro Admin')

    const segunda = await unmarkOutlier(null, unmarkForm(s.project, s.round, mark.id))
    expect(segunda).toMatchObject({ error: expect.stringContaining('já foi removida') })

    const [aindaAssim] = await marksOf(s.round)
    expect(aindaAssim.removedBy).toBe(outroAdmin)
    expect(aindaAssim.removedAt).toBe(removida.removedAt)
  })

  it('depois de desmarcar, a mesma pessoa pode ser marcada de novo na mesma rodada', async () => {
    const s = await scenario()
    auth.userId = s.admin

    await markOutlier(null, markForm(s.project, s.round, s.evaluator))
    const [primeira] = await marksOf(s.round)
    await unmarkOutlier(null, unmarkForm(s.project, s.round, primeira.id))

    const result = await markOutlier(
      null,
      markForm(s.project, s.round, s.evaluator, 'Marcada de novo depois de rever.'),
    )
    expect(result).toMatchObject({ ok: true })

    expect(await marksOf(s.round)).toHaveLength(2)
    const active = await loadRoundOutliers(s.round)
    expect(active).toHaveLength(1)
    expect(active[0].reason).toBe('Marcada de novo depois de rever.')
  })
})
