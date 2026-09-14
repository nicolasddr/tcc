// lib/db/evaluations.int.test.ts — testes de integração das garantias de SCHEMA das
// tabelas `evaluations` e `scores` (issue #60, Parte 1).
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
// Rodam sob transação-com-rollback (ver test/helpers.ts): não sujam o banco.
import { describe, it, expect } from 'vitest'
import { and, eq } from 'drizzle-orm'
import {
  pgErrorCode,
  type Transaction,
  codebookCriteria,
  codebookDefinitions,
  evaluations,
  projectMembers,
  scores,
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
  addScore,
} from '@/test/helpers'

type Scenario = {
  admin: string
  evaluator: string
  project: string
  round: string
  response: string
  memberLink: string
  definitions: { id: string; title: string }[]
  general: string
}

async function scenario(tx: Transaction): Promise<Scenario> {
  const admin = await createUser(tx, 'Admin')
  const evaluator = await createUser(tx, 'Avaliador')
  const project = await createProject(tx, admin)
  const memberLink = await addActiveEvaluator(tx, project, evaluator)

  const codebook = await addCodebookVersion(tx, project, admin, {
    definitions: [
      { title: 'Definição A', type: 'category' },
      { title: 'Definição B', type: 'category' },
    ],
    generalCriteria: [{ name: 'Clareza' }],
  })
  const prompt = await addPromptVersion(tx, project, admin)
  const item = await addInputItem(tx, project, admin)
  const round = await addRound(tx, project, admin, codebook, prompt)
  const response = await addResponse(tx, round, item, admin)

  const definitions = await tx
    .select({ id: codebookDefinitions.id, title: codebookDefinitions.title })
    .from(codebookDefinitions)
    .where(eq(codebookDefinitions.codebookVersionId, codebook))
    .orderBy(codebookDefinitions.orderIndex)

  const [general] = await tx
    .select({ id: codebookCriteria.id })
    .from(codebookCriteria)
    .where(eq(codebookCriteria.codebookVersionId, codebook))

  return { admin, evaluator, project, round, response, memberLink, definitions, general: general.id }
}

describe('schema de avaliação — evaluations e scores', () => {
  it('ev_unique_response_member: o mesmo vínculo não avalia a mesma resposta duas vezes', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      await addEvaluation(tx, s.round, s.response, s.memberLink)

      const err = await tx
        .insert(evaluations)
        .values({ roundId: s.round, responseId: s.response, projectMemberId: s.memberLink })
        .then(() => null, (e: unknown) => e)

      expect(pgErrorCode(err)).toBe('23505')
    })
  })

  it('sc_unique_cell: recusa a nota repetida na mesma célula', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const evaluation = await addEvaluation(tx, s.round, s.response, s.memberLink)
      await addScore(tx, evaluation, s.definitions[0].id, s.general)

      const err = await tx
        .insert(scores)
        .values({
          evaluationId: evaluation,
          definitionId: s.definitions[0].id,
          criterionId: s.general,
          value: 'low',
        })
        .then(() => null, (e: unknown) => e)

      expect(pgErrorCode(err)).toBe('23505')
    })
  })

  it('sc_unique_cell: o mesmo critério geral tem uma nota em cada definição', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const evaluation = await addEvaluation(tx, s.round, s.response, s.memberLink)

      await addScore(tx, evaluation, s.definitions[0].id, s.general, { value: 'high' })
      await addScore(tx, evaluation, s.definitions[1].id, s.general, { value: 'low' })

      const rows = await tx
        .select({ definitionId: scores.definitionId, value: scores.value })
        .from(scores)
        .where(and(eq(scores.evaluationId, evaluation), eq(scores.criterionId, s.general)))

      expect(rows).toHaveLength(2)
      expect(new Set(rows.map((r) => r.definitionId))).toEqual(
        new Set([s.definitions[0].id, s.definitions[1].id]),
      )
    })
  })

  it('sc_value_check: recusa valor fora da escala', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const evaluation = await addEvaluation(tx, s.round, s.response, s.memberLink)

      const err = await tx
        .insert(scores)
        .values({
          evaluationId: evaluation,
          definitionId: s.definitions[0].id,
          criterionId: s.general,
          value: 'excelente',
        })
        .then(() => null, (e: unknown) => e)

      expect(pgErrorCode(err)).toBe('23514')
    })
  })

  it('sc_justification_len: recusa justificativa acima do limite', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const evaluation = await addEvaluation(tx, s.round, s.response, s.memberLink)

      const err = await tx
        .insert(scores)
        .values({
          evaluationId: evaluation,
          definitionId: s.definitions[0].id,
          criterionId: s.general,
          value: 'high',
          justification: 'x'.repeat(2001),
        })
        .then(() => null, (e: unknown) => e)

      expect(pgErrorCode(err)).toBe('23514')
    })
  })

  it('desativar o vínculo do avaliador NÃO apaga a avaliação', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const evaluation = await addEvaluation(tx, s.round, s.response, s.memberLink, {
        cells: [{ definitionId: s.definitions[0].id, criterionId: s.general }],
      })

      await tx
        .update(projectMembers)
        .set({ status: 'inactive' })
        .where(eq(projectMembers.id, s.memberLink))

      const rows = await tx.select().from(evaluations).where(eq(evaluations.id, evaluation))
      expect(rows).toHaveLength(1)
      expect(await tx.select().from(scores).where(eq(scores.evaluationId, evaluation))).toHaveLength(
        1,
      )
    })
  })

  it('apagar o vínculo do avaliador é RECUSADO enquanto houver avaliação', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      await addEvaluation(tx, s.round, s.response, s.memberLink)

      const err = await tx
        .delete(projectMembers)
        .where(eq(projectMembers.id, s.memberLink))
        .then(() => null, (e: unknown) => e)

      expect(pgErrorCode(err)).toBe('23503')
    })
  })

  it('apagar a avaliação leva as notas junto (cascade)', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const evaluation = await addEvaluation(tx, s.round, s.response, s.memberLink, {
        cells: [
          { definitionId: s.definitions[0].id, criterionId: s.general },
          { definitionId: s.definitions[1].id, criterionId: s.general },
        ],
      })

      await tx.delete(evaluations).where(eq(evaluations.id, evaluation))

      expect(await tx.select().from(scores).where(eq(scores.evaluationId, evaluation))).toEqual([])
    })
  })
})
