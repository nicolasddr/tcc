import { describe, it, expect } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { loadEvaluatorParticipation } from '@/app/projects/[id]/(tabs)/rounds/participation'
import { projectMembers, type Transaction } from '@/lib/db'
import {
  inRollbackTx,
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
} from '@/test/helpers'

async function scenario(tx: Transaction) {
  const admin = await createUser(tx, 'Admin')
  const project = await createProject(tx, admin)
  const codebookVersion = await addCodebookVersion(tx, project, admin)
  const promptVersion = await addPromptVersion(tx, project, admin)
  const firstItem = await addInputItem(tx, project, admin, { name: 'Item 1' })
  const secondItem = await addInputItem(tx, project, admin, { name: 'Item 2' })

  async function round(roundNumber: number, phase: number, status: 'open' | 'closed') {
    const id = await addRound(tx, project, admin, codebookVersion, promptVersion, {
      roundNumber,
      phase,
      status,
    })
    return {
      id,
      first: await addResponse(tx, id, firstItem, admin),
      second: await addResponse(tx, id, secondItem, admin),
    }
  }

  async function evaluator(name: string) {
    return addActiveEvaluator(tx, project, await createUser(tx, name))
  }

  return { admin, project, round, evaluator }
}

describe('loadEvaluatorParticipation — em quais rodadas cada vínculo avaliou', () => {
  it('sai das avaliações enviadas, por vínculo, e cada rodada conta uma vez', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const round1 = await s.round(1, 2, 'closed')
      const round2 = await s.round(2, 2, 'closed')
      const round3 = await s.round(3, 3, 'closed')
      const ana = await s.evaluator('Ana')
      const bia = await s.evaluator('Bia')

      await addEvaluation(tx, round3.id, round3.first, ana)
      await addEvaluation(tx, round1.id, round1.first, ana)
      await addEvaluation(tx, round1.id, round1.second, ana)
      await addEvaluation(tx, round2.id, round2.first, bia)

      const participation = await loadEvaluatorParticipation(s.project, tx)

      expect(participation.get(ana)).toEqual([
        { roundNumber: 1, phase: 2 },
        { roundNumber: 3, phase: 3 },
      ])
      expect(participation.get(bia)).toEqual([{ roundNumber: 2, phase: 2 }])
    })
  })

  it('quem nunca avaliou não tem chave', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const round1 = await s.round(1, 2, 'closed')
      const ana = await s.evaluator('Ana')
      const carla = await s.evaluator('Carla')

      await addEvaluation(tx, round1.id, round1.first, ana)

      const participation = await loadEvaluatorParticipation(s.project, tx)

      expect(participation.has(carla)).toBe(false)
      expect([...participation.keys()]).toEqual([ana])
    })
  })

  it('o Administrador-avaliador conta pelo vínculo de avaliador', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const round1 = await s.round(1, 2, 'closed')
      const asEvaluator = await addActiveEvaluator(tx, s.project, s.admin)
      const [asAdministrator] = await tx
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, s.project),
            eq(projectMembers.userId, s.admin),
            eq(projectMembers.role, 'administrator'),
          ),
        )

      await addEvaluation(tx, round1.id, round1.first, asEvaluator)

      const participation = await loadEvaluatorParticipation(s.project, tx)

      expect(participation.get(asEvaluator)).toEqual([{ roundNumber: 1, phase: 2 }])
      expect(participation.has(asAdministrator.id)).toBe(false)
    })
  })

  it('inclui a rodada aberta, a rodada em que o vínculo é outlier e o vínculo inativo', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const round1 = await s.round(1, 2, 'closed')
      const round2 = await s.round(2, 3, 'open')
      const ana = await s.evaluator('Ana')

      await addEvaluation(tx, round1.id, round1.first, ana)
      await addEvaluation(tx, round2.id, round2.first, ana)
      await addOutlier(tx, round1.id, ana, s.admin)
      await tx
        .update(projectMembers)
        .set({ status: 'inactive' })
        .where(eq(projectMembers.id, ana))

      const participation = await loadEvaluatorParticipation(s.project, tx)

      expect(participation.get(ana)).toEqual([
        { roundNumber: 1, phase: 2 },
        { roundNumber: 2, phase: 3 },
      ])
    })
  })

  it('não mistura a participação de outro projeto', async () => {
    await inRollbackTx(async (tx) => {
      const mine = await scenario(tx)
      const theirs = await scenario(tx)
      const myRound = await mine.round(1, 2, 'closed')
      const theirRound = await theirs.round(1, 2, 'closed')
      const ana = await mine.evaluator('Ana')
      const bia = await theirs.evaluator('Bia')

      await addEvaluation(tx, myRound.id, myRound.first, ana)
      await addEvaluation(tx, theirRound.id, theirRound.first, bia)

      const participation = await loadEvaluatorParticipation(mine.project, tx)

      expect([...participation.keys()]).toEqual([ana])
    })
  })
})
