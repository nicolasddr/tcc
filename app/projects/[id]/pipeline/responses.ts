import { and, asc, eq } from 'drizzle-orm'
import { ownerDb, type DbExecutor, inputItems, responses, rounds } from '@/lib/db'
import {
  loadCodebookVersion,
  type CodebookCriterion,
  type CodebookDefinition,
} from './codebook'
import { loadPromptVersion } from './prompt'
import { isUuid } from './versions'

export type RoundComposition = {
  phase: number
  promptVersionId: string
  codebookVersionId: string
  promptText: string
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
}

export type ItemRoundUsage = Map<string, number[]>

export type RoundResponse = {
  id: string
  itemId: string
  itemName: string
  createdAt: string
}

export type ResponseDetail = RoundResponse & { text: string }

export async function loadRoundComposition(
  projectId: string,
  roundId: string,
  db: DbExecutor = ownerDb,
): Promise<RoundComposition | null> {
  if (!isUuid(roundId)) return null

  const [round] = await db
    .select({
      phase: rounds.phase,
      promptVersionId: rounds.promptVersionId,
      codebookVersionId: rounds.codebookVersionId,
    })
    .from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.projectId, projectId)))
    .limit(1)

  if (!round) return null

  const prompt = await loadPromptVersion(projectId, round.promptVersionId, db)
  const codebook = await loadCodebookVersion(projectId, round.codebookVersionId, db)
  if (!prompt || !codebook) return null

  return {
    phase: round.phase,
    promptVersionId: round.promptVersionId,
    codebookVersionId: round.codebookVersionId,
    promptText: prompt.text,
    definitions: codebook.definitions,
    criteria: codebook.criteria,
  }
}

export async function loadItemRoundUsage(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<ItemRoundUsage> {
  const rows = await db
    .select({ itemId: responses.inputItemId, roundNumber: rounds.roundNumber })
    .from(responses)
    .innerJoin(rounds, eq(rounds.id, responses.roundId))
    .where(eq(rounds.projectId, projectId))
    .orderBy(asc(rounds.roundNumber))

  const usage: ItemRoundUsage = new Map()

  for (const row of rows) {
    const roundNumbers = usage.get(row.itemId)
    if (roundNumbers) roundNumbers.push(row.roundNumber)
    else usage.set(row.itemId, [row.roundNumber])
  }

  return usage
}

export async function loadItemsUsedInRound(
  roundId: string,
  db: DbExecutor = ownerDb,
): Promise<string[]> {
  if (!isUuid(roundId)) return []

  const rows = await db
    .select({ itemId: responses.inputItemId })
    .from(responses)
    .where(eq(responses.roundId, roundId))

  return rows.map((row) => row.itemId)
}

export async function listRoundResponses(
  roundId: string,
  db: DbExecutor = ownerDb,
): Promise<RoundResponse[]> {
  if (!isUuid(roundId)) return []

  return db
    .select({
      id: responses.id,
      itemId: responses.inputItemId,
      itemName: inputItems.name,
      createdAt: responses.createdAt,
    })
    .from(responses)
    .innerJoin(inputItems, eq(inputItems.id, responses.inputItemId))
    .where(eq(responses.roundId, roundId))
    .orderBy(asc(responses.createdAt), asc(responses.id))
}

export async function loadRoundResponse(
  roundId: string,
  responseId: string,
  db: DbExecutor = ownerDb,
): Promise<ResponseDetail | null> {
  if (!isUuid(roundId) || !isUuid(responseId)) return null

  const [response] = await db
    .select({
      id: responses.id,
      itemId: responses.inputItemId,
      itemName: inputItems.name,
      text: responses.text,
      createdAt: responses.createdAt,
    })
    .from(responses)
    .innerJoin(inputItems, eq(inputItems.id, responses.inputItemId))
    .where(and(eq(responses.id, responseId), eq(responses.roundId, roundId)))
    .limit(1)

  return response ?? null
}
