import { ownerDb, type DbExecutor } from '@/lib/db'
import { loadCodebook } from './codebook'
import { loadPrompt } from './prompt'
import { countItems } from './items'
import type { PipelineInputs } from './preconditions'

export async function loadPipelineInputs(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<PipelineInputs> {
  const codebook = await loadCodebook(projectId, db)
  const prompt = await loadPrompt(projectId, db)
  const items = await countItems(projectId, db)

  return {
    definitions: codebook.definitions.length,
    promptText: prompt.version?.text ?? null,
    items,
  }
}
