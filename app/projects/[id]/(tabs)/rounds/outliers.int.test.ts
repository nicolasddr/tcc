// app/projects/[id]/(tabs)/rounds/outliers.int.test.ts — garantias de SCHEMA da tabela
// `round_outliers` e leituras da marca (issue #65, Parte 1).
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
// Rodam sob transação-com-rollback (ver test/helpers.ts): não sujam o banco.
import { describe, it, expect } from 'vitest'
import { and, eq, isNull } from 'drizzle-orm'
import {
  excludedMemberIds,
  loadOutlierHistory,
  loadProjectOutliers,
  loadRoundOutliers,
} from '@/app/projects/[id]/(tabs)/rounds/outliers'
import {
  pgErrorCode,
  type Transaction,
  evaluations,
  projectMembers,
  roundOutliers,
} from '@/lib/db'
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

type Scenario = {
  admin: string
  project: string
  round: string
  response: string
  evaluator: string
}

async function scenario(tx: Transaction): Promise<Scenario> {
  const admin = await createUser(tx, 'Admin')
  const project = await createProject(tx, admin)
  const evaluator = await addActiveEvaluator(tx, project, await createUser(tx, 'Ana'))

  const codebook = await addCodebookVersion(tx, project, admin)
  const prompt = await addPromptVersion(tx, project, admin)
  const item = await addInputItem(tx, project, admin)
  const round = await addRound(tx, project, admin, codebook, prompt)
  const response = await addResponse(tx, round, item, admin)
  await addEvaluation(tx, round, response, evaluator)

  return { admin, project, round, response, evaluator }
}

async function addSecondRound(
  tx: Transaction,
  s: Scenario,
  roundNumber = 2,
): Promise<{ round: string; response: string }> {
  const codebook = await addCodebookVersion(tx, s.project, s.admin, {
    versionNumber: roundNumber,
  })
  const prompt = await addPromptVersion(tx, s.project, s.admin, {
    versionNumber: roundNumber,
  })
  const item = await addInputItem(tx, s.project, s.admin, { name: `Item ${roundNumber}` })
  const round = await addRound(tx, s.project, s.admin, codebook, prompt, {
    roundNumber,
    status: 'closed',
  })
  const response = await addResponse(tx, round, item, s.admin)
  await addEvaluation(tx, round, response, s.evaluator)
  return { round, response }
}

async function refused(
  tx: Transaction,
  write: (sp: Transaction) => Promise<unknown>,
): Promise<unknown> {
  return tx.transaction(async (sp) => void (await write(sp))).then(
    () => null,
    (e: unknown) => e,
  )
}

async function remove(tx: Transaction, markId: string, removedBy: string): Promise<void> {
  await tx
    .update(roundOutliers)
    .set({ removedBy, removedAt: new Date().toISOString() })
    .where(eq(roundOutliers.id, markId))
}

describe('schema da marca de outlier — round_outliers', () => {
  it('ro_one_active_per_member: uma marca ativa por vínculo por rodada, e o histórico continua possível', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const first = await addOutlier(tx, s.round, s.evaluator, s.admin)

      const err = await refused(tx, (sp) =>
        addOutlier(sp, s.round, s.evaluator, s.admin, { reason: 'Outra razão' }),
      )
      expect(pgErrorCode(err)).toBe('23505')

      await remove(tx, first, s.admin)
      const second = await addOutlier(tx, s.round, s.evaluator, s.admin, {
        reason: 'Marcada de novo',
      })

      const all = await tx
        .select({ id: roundOutliers.id })
        .from(roundOutliers)
        .where(eq(roundOutliers.roundId, s.round))
      const active = await tx
        .select({ id: roundOutliers.id })
        .from(roundOutliers)
        .where(and(eq(roundOutliers.roundId, s.round), isNull(roundOutliers.removedAt)))

      expect(new Set(all.map((row) => row.id))).toEqual(new Set([first, second]))
      expect(active.map((row) => row.id)).toEqual([second])
    })
  })

  it('ro_reason_not_blank e ro_reason_len: justificativa vazia, em branco ou acima do teto é recusada', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)

      for (const reason of ['', '   ', 'x'.repeat(2001)]) {
        const err = await refused(tx, (sp) =>
          addOutlier(sp, s.round, s.evaluator, s.admin, { reason }),
        )
        expect(pgErrorCode(err)).toBe('23514')
      }

      expect(await loadRoundOutliers(s.round, tx)).toEqual([])
    })
  })

  it('ro_removal_paired: meia remoção é recusada nos dois sentidos', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const mark = await addOutlier(tx, s.round, s.evaluator, s.admin)

      const semAutor = await refused(tx, (sp) =>
        sp
          .update(roundOutliers)
          .set({ removedAt: new Date().toISOString() })
          .where(eq(roundOutliers.id, mark)),
      )
      const semData = await refused(tx, (sp) =>
        sp
          .update(roundOutliers)
          .set({ removedBy: s.admin })
          .where(eq(roundOutliers.id, mark)),
      )

      expect(pgErrorCode(semAutor)).toBe('23514')
      expect(pgErrorCode(semData)).toBe('23514')
      expect(await loadRoundOutliers(s.round, tx)).toHaveLength(1)
    })
  })

  it('a marca é por rodada: marcar na rodada 1 não marca o mesmo vínculo na rodada 2', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const segunda = await addSecondRound(tx, s)

      await addOutlier(tx, s.round, s.evaluator, s.admin)

      const naPrimeira = await loadRoundOutliers(s.round, tx)
      expect(naPrimeira).toHaveLength(1)
      expect(naPrimeira[0].projectMemberId).toBe(s.evaluator)
      expect(naPrimeira[0].evaluatorName).toBe('Ana')
      expect(naPrimeira[0].markedByName).toBe('Admin')
      expect(naPrimeira[0].removedAt).toBeNull()
      expect(naPrimeira[0].removedByName).toBeNull()

      expect(await loadRoundOutliers(segunda.round, tx)).toEqual([])
    })
  })

  it('remover não apaga: sai das marcas ativas e continua no histórico, com autor e data', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const removedor = await createUser(tx, 'Outro Admin')
      const mark = await addOutlier(tx, s.round, s.evaluator, s.admin)

      await remove(tx, mark, removedor)

      expect(await loadRoundOutliers(s.round, tx)).toEqual([])

      const history = await loadOutlierHistory(s.round, tx)
      expect(history).toHaveLength(1)
      expect(history[0].id).toBe(mark)
      expect(history[0].markedByName).toBe('Admin')
      expect(history[0].removedByName).toBe('Outro Admin')
      expect(history[0].removedAt).not.toBeNull()
    })
  })

  it('o histórico vem da mais recente para a mais antiga', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const antiga = await addOutlier(tx, s.round, s.evaluator, s.admin, {
        markedAt: '2026-01-01T12:00:00Z',
        removedBy: s.admin,
        removedAt: '2026-01-02T12:00:00Z',
      })
      const recente = await addOutlier(tx, s.round, s.evaluator, s.admin, {
        markedAt: '2026-02-01T12:00:00Z',
      })

      expect((await loadOutlierHistory(s.round, tx)).map((mark) => mark.id)).toEqual([
        recente,
        antiga,
      ])
    })
  })

  it('desativar o vínculo não apaga a marca nem a avaliação', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const mark = await addOutlier(tx, s.round, s.evaluator, s.admin)

      await tx
        .update(projectMembers)
        .set({ status: 'inactive' })
        .where(eq(projectMembers.id, s.evaluator))

      expect((await loadRoundOutliers(s.round, tx)).map((row) => row.id)).toEqual([mark])
      expect(
        await tx
          .select({ id: evaluations.id })
          .from(evaluations)
          .where(eq(evaluations.projectMemberId, s.evaluator)),
      ).toHaveLength(1)
    })
  })

  it('loadProjectOutliers agrupa por rodada, ignora as removidas e não vê outro projeto', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const segunda = await addSecondRound(tx, s)
      const bruno = await addActiveEvaluator(tx, s.project, await createUser(tx, 'Bruno'))
      await addEvaluation(tx, segunda.round, segunda.response, bruno)

      const removida = await addOutlier(tx, s.round, s.evaluator, s.admin)
      await remove(tx, removida, s.admin)
      await addOutlier(tx, segunda.round, s.evaluator, s.admin)
      await addOutlier(tx, segunda.round, bruno, s.admin)

      const outro = await scenario(tx)
      await addOutlier(tx, outro.round, outro.evaluator, outro.admin)

      const byRound = await loadProjectOutliers(s.project, tx)

      expect([...byRound.keys()]).toEqual([segunda.round])
      expect(byRound.get(segunda.round)).toEqual(new Set([s.evaluator, bruno]))
      expect(excludedMemberIds(await loadRoundOutliers(segunda.round, tx))).toEqual(
        new Set([s.evaluator, bruno]),
      )
      expect(excludedMemberIds(await loadRoundOutliers(s.round, tx))).toEqual(new Set())
    })
  })
})
