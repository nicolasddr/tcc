import { and, eq } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  inputItems,
  promptVersions,
  responses,
  rounds,
} from '@/lib/db'
import { isUuid } from '../../pipeline/versions'

export type EvaluationContext = {
  prompt: {
    versionNumber: number
    name: string | null
    description: string | null
    text: string
  }
  item: { name: string; content: string }
}

export async function loadEvaluationContext(
  projectId: string,
  responseId: string,
  db: DbExecutor = ownerDb,
): Promise<EvaluationContext | null> {
  if (!isUuid(projectId) || !isUuid(responseId)) return null

  const [row] = await db
    .select({
      versionNumber: promptVersions.versionNumber,
      name: promptVersions.name,
      description: promptVersions.description,
      text: promptVersions.text,
      itemName: inputItems.name,
      itemContent: inputItems.content,
    })
    .from(responses)
    .innerJoin(rounds, eq(rounds.id, responses.roundId))
    .innerJoin(inputItems, eq(inputItems.id, responses.inputItemId))
    .innerJoin(promptVersions, eq(promptVersions.id, responses.promptVersionId))
    .where(and(eq(responses.id, responseId), eq(rounds.projectId, projectId)))
    .limit(1)

  if (!row) return null

  return {
    prompt: {
      versionNumber: row.versionNumber,
      name: row.name,
      description: row.description,
      text: row.text,
    },
    item: { name: row.itemName, content: row.itemContent },
  }
}
