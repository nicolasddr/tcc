import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  pgErrorCode,
  type Transaction,
  codebookCriteria,
  codebookDefinitions,
  consensusNotes,
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
  addConsensusNote,
} from '@/test/helpers'

type Scenario = {
  codebook: string
  round: string
  response: string
  memberLink: string
  evaluation: string
  definitions: string[]
  specific: string
  general: string
  perResponse: string
}

async function scenario(tx: Transaction): Promise<Scenario> {
  const admin = await createUser(tx, 'Admin')
  const evaluator = await createUser(tx, 'Avaliador')
  const project = await createProject(tx, admin)
  const memberLink = await addActiveEvaluator(tx, project, evaluator)

  const codebook = await addCodebookVersion(tx, project, admin, {
    definitions: [
      { title: 'Definição A', type: 'category', criteria: [{ name: 'Específico' }] },
      { title: 'Definição B', type: 'category' },
    ],
    generalCriteria: [{ name: 'Geral' }],
    perResponseCriteria: [{ name: 'Por resposta' }],
  })
  const prompt = await addPromptVersion(tx, project, admin)
  const item = await addInputItem(tx, project, admin)
  const round = await addRound(tx, project, admin, codebook, prompt)
  const response = await addResponse(tx, round, item, admin)
  const evaluation = await addEvaluation(tx, round, response, memberLink)

  const definitions = await tx
    .select({ id: codebookDefinitions.id })
    .from(codebookDefinitions)
    .where(eq(codebookDefinitions.codebookVersionId, codebook))
    .orderBy(codebookDefinitions.orderIndex)

  const criteria = await tx
    .select({ id: codebookCriteria.id, name: codebookCriteria.name })
    .from(codebookCriteria)
    .where(eq(codebookCriteria.codebookVersionId, codebook))
  const idOf = (name: string) => criteria.find((c) => c.name === name)!.id

  return {
    codebook,
    round,
    response,
    memberLink,
    evaluation,
    definitions: definitions.map((d) => d.id),
    specific: idOf('Específico'),
    general: idOf('Geral'),
    perResponse: idOf('Por resposta'),
  }
}

function insertScore(
  tx: Transaction,
  s: Scenario,
  definitionId: string | null,
  criterionId: string,
) {
  return tx
    .insert(scores)
    .values({ evaluationId: s.evaluation, definitionId, criterionId, value: 'high' })
    .then(() => null, (e: unknown) => e)
}

function insertNote(
  tx: Transaction,
  s: Scenario,
  definitionId: string | null,
  criterionId: string,
) {
  return tx
    .insert(consensusNotes)
    .values({
      roundId: s.round,
      responseId: s.response,
      definitionId,
      criterionId,
      projectMemberId: s.memberLink,
      visibility: 'private',
      text: 'Anotação',
    })
    .then(() => null, (e: unknown) => e)
}

function insertCriterion(
  tx: Transaction,
  s: Scenario,
  scope: string,
  definitionId: string | null,
) {
  return tx
    .insert(codebookCriteria)
    .values({
      codebookVersionId: s.codebook,
      definitionId,
      scope,
      name: 'Critério novo',
      orderIndex: 9,
    })
    .then(() => null, (e: unknown) => e)
}

describe('schema do tipo do critério — codebook_criteria, scores e consensus_notes', () => {
  it('o helper grava o tipo de cada critério', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)

      const rows = await tx
        .select({ id: codebookCriteria.id, scope: codebookCriteria.scope })
        .from(codebookCriteria)
        .where(eq(codebookCriteria.codebookVersionId, s.codebook))
      const scopeOf = new Map(rows.map((r) => [r.id, r.scope]))

      expect(scopeOf.get(s.specific)).toBe('specific')
      expect(scopeOf.get(s.general)).toBe('general')
      expect(scopeOf.get(s.perResponse)).toBe('per_response')
    })
  })

  it('cc_scope_definition: recusa o critério geral com definição', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertCriterion(tx, s, 'general', s.definitions[0]))).toBe('23514')
    })
  })

  it('cc_scope_definition: recusa o critério específico sem definição', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertCriterion(tx, s, 'specific', null))).toBe('23514')
    })
  })

  it('cc_scope_definition: recusa o critério por resposta com definição', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertCriterion(tx, s, 'per_response', s.definitions[0]))).toBe(
        '23514',
      )
    })
  })

  it('cc_scope_check: recusa tipo fora dos três', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertCriterion(tx, s, 'geral', null))).toBe('23514')
    })
  })

  it('aceita a nota sem definição no critério por resposta', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      await addScore(tx, s.evaluation, null, s.perResponse)

      const rows = await tx
        .select({ definitionId: scores.definitionId })
        .from(scores)
        .where(eq(scores.evaluationId, s.evaluation))

      expect(rows).toEqual([{ definitionId: null }])
    })
  })

  it('R15 em scores: recusa a nota sem definição no critério geral', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertScore(tx, s, null, s.general))).toBe('23503')
    })
  })

  it('R15 em scores: recusa a nota sem definição no critério específico', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertScore(tx, s, null, s.specific))).toBe('23503')
    })
  })

  it('R15 em scores: recusa a nota com definição no critério por resposta', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertScore(tx, s, s.definitions[0], s.perResponse))).toBe('23503')
    })
  })

  it('R14 em scores: recusa a segunda nota sem definição no mesmo critério', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      await addScore(tx, s.evaluation, null, s.perResponse)
      expect(pgErrorCode(await insertScore(tx, s, null, s.perResponse))).toBe('23505')
    })
  })

  it('R16 em consensus_notes: recusa a anotação sem definição no critério geral', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertNote(tx, s, null, s.general))).toBe('23503')
    })
  })

  it('R16 em consensus_notes: recusa a anotação sem definição no critério específico', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertNote(tx, s, null, s.specific))).toBe('23503')
    })
  })

  it('R16 em consensus_notes: recusa a anotação com definição no critério por resposta', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      expect(pgErrorCode(await insertNote(tx, s, s.definitions[0], s.perResponse))).toBe('23503')
    })
  })

  it('R16 em consensus_notes: recusa a segunda anotação sem definição do mesmo autor', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        definitionId: null,
        criterionId: s.perResponse,
        projectMemberId: s.memberLink,
        visibility: 'shared',
      })
      expect(pgErrorCode(await insertNote(tx, s, null, s.perResponse))).toBe('23505')
    })
  })

  it('o tipo do critério fica preso à nota que já existe', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      await addScore(tx, s.evaluation, null, s.perResponse)

      const err = await tx
        .update(codebookCriteria)
        .set({ scope: 'general', definitionId: null })
        .where(eq(codebookCriteria.id, s.perResponse))
        .then(() => null, (e: unknown) => e)

      expect(pgErrorCode(err)).toBe('23503')
    })
  })
})
