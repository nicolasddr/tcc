import { and, desc, eq } from 'drizzle-orm'
import { ownerDb, type DbExecutor, profiles, promptVersions } from '@/lib/db'
import { isVersionOpen } from '@/lib/versioning'
import { isUuid, summarize, type Summarized } from './versions'

export type PromptMetadata = {
  name: string | null
  description: string | null
  changeLog: string | null
}

export type PromptVersion = PromptMetadata & {
  id: string
  versionNumber: number
  text: string
  createdAt: string
  updatedAt: string | null
  usedAt: string | null
}

export type PromptVersionSummary = Summarized<PromptVersion & { authorName: string }>

export type Prompt = {
  version: PromptVersion | null
  isOpen: boolean
}

const versionColumns = {
  id: promptVersions.id,
  versionNumber: promptVersions.versionNumber,
  text: promptVersions.text,
  name: promptVersions.name,
  description: promptVersions.description,
  changeLog: promptVersions.changeLog,
  createdAt: promptVersions.createdAt,
  updatedAt: promptVersions.updatedAt,
  usedAt: promptVersions.usedAt,
}

async function latestVersion(
  projectId: string,
  db: DbExecutor,
): Promise<PromptVersion | null> {
  const [version] = await db
    .select(versionColumns)
    .from(promptVersions)
    .where(eq(promptVersions.projectId, projectId))
    .orderBy(desc(promptVersions.versionNumber))
    .limit(1)

  return version ?? null
}

export async function loadPrompt(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<Prompt> {
  const version = await latestVersion(projectId, db)

  if (!version) return { version: null, isOpen: true }

  return { version, isOpen: isVersionOpen(version, version) }
}

export async function listPromptVersions(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<PromptVersionSummary[]> {
  const versions = await db
    .select({ ...versionColumns, authorName: profiles.name })
    .from(promptVersions)
    .innerJoin(profiles, eq(profiles.id, promptVersions.createdBy))
    .where(eq(promptVersions.projectId, projectId))
    .orderBy(desc(promptVersions.versionNumber))

  const latest = versions[0] ?? null
  return versions.map((version) => summarize(version, latest))
}

export async function loadPromptVersion(
  projectId: string,
  versionId: string,
  db: DbExecutor = ownerDb,
): Promise<PromptVersionSummary | null> {
  if (!isUuid(versionId)) return null

  const [version] = await db
    .select({ ...versionColumns, authorName: profiles.name })
    .from(promptVersions)
    .innerJoin(profiles, eq(profiles.id, promptVersions.createdBy))
    .where(
      and(eq(promptVersions.id, versionId), eq(promptVersions.projectId, projectId)),
    )
    .limit(1)

  if (!version) return null

  return summarize(version, await latestVersion(projectId, db))
}

export function hasPromptMetadata(version: PromptMetadata): boolean {
  return Boolean(version.name || version.description || version.changeLog)
}
