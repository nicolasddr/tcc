import { desc, eq } from 'drizzle-orm'
import { ownerDb, type DbExecutor, promptVersions } from '@/lib/db'
import { isVersionOpen } from '@/lib/versioning'

export type PromptVersion = {
  id: string
  versionNumber: number
  text: string
  createdAt: string
  updatedAt: string | null
  usedAt: string | null
}

export type Prompt = {
  version: PromptVersion | null
  isOpen: boolean
}

export async function loadPrompt(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<Prompt> {
  const [version] = await db
    .select({
      id: promptVersions.id,
      versionNumber: promptVersions.versionNumber,
      text: promptVersions.text,
      createdAt: promptVersions.createdAt,
      updatedAt: promptVersions.updatedAt,
      usedAt: promptVersions.usedAt,
    })
    .from(promptVersions)
    .where(eq(promptVersions.projectId, projectId))
    .orderBy(desc(promptVersions.versionNumber))
    .limit(1)

  if (!version) return { version: null, isOpen: true }

  return { version, isOpen: isVersionOpen(version, version) }
}
