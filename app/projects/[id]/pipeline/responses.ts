import { and, asc, eq } from 'drizzle-orm'
import { ownerDb, type DbExecutor, responses, rounds } from '@/lib/db'
import { loadCodebookVersion } from './codebook'
import { loadPromptVersion } from './prompt'
import { isUuid } from './versions'

export type RoundComposition = {
  promptVersionId: string
  codebookVersionId: string
  promptText: string
  definitionTitles: string[]
}

export type ItemRoundUsage = Map<string, number[]>

export async function loadRoundComposition(
  projectId: string,
  roundId: string,
  db: DbExecutor = ownerDb,
): Promise<RoundComposition | null> {
  if (!isUuid(roundId)) return null

  const [round] = await db
    .select({
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
    promptVersionId: round.promptVersionId,
    codebookVersionId: round.codebookVersionId,
    promptText: prompt.text,
    definitionTitles: codebook.definitions.map((definition) => definition.title),
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
