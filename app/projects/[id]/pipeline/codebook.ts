import { and, asc, desc, eq } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  profiles,
  codebookVersions,
  codebookDefinitions,
} from '@/lib/db'
import { isVersionOpen } from '@/lib/versioning'
import { isUuid, summarize, type Summarized } from './versions'

export type CodebookVersion = {
  id: string
  versionNumber: number
  note: string | null
  createdAt: string
  updatedAt: string | null
  usedAt: string | null
}

export type CodebookVersionSummary = Summarized<CodebookVersion & { authorName: string }>

export type CodebookDefinition = {
  id: string
  title: string
  type: string
  orderIndex: number
}

export type Codebook = {
  version: CodebookVersion | null
  definitions: CodebookDefinition[]
  isOpen: boolean
}

export type CodebookVersionDetail = {
  version: CodebookVersionSummary
  definitions: CodebookDefinition[]
}

const versionColumns = {
  id: codebookVersions.id,
  versionNumber: codebookVersions.versionNumber,
  note: codebookVersions.note,
  createdAt: codebookVersions.createdAt,
  updatedAt: codebookVersions.updatedAt,
  usedAt: codebookVersions.usedAt,
}

async function latestVersion(
  projectId: string,
  db: DbExecutor,
): Promise<CodebookVersion | null> {
  const [version] = await db
    .select(versionColumns)
    .from(codebookVersions)
    .where(eq(codebookVersions.projectId, projectId))
    .orderBy(desc(codebookVersions.versionNumber))
    .limit(1)

  return version ?? null
}

function loadDefinitions(
  versionId: string,
  db: DbExecutor,
): Promise<CodebookDefinition[]> {
  return db
    .select({
      id: codebookDefinitions.id,
      title: codebookDefinitions.title,
      type: codebookDefinitions.type,
      orderIndex: codebookDefinitions.orderIndex,
    })
    .from(codebookDefinitions)
    .where(eq(codebookDefinitions.codebookVersionId, versionId))
    .orderBy(asc(codebookDefinitions.orderIndex))
}

export async function loadCodebook(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<Codebook> {
  const version = await latestVersion(projectId, db)

  if (!version) return { version: null, definitions: [], isOpen: true }

  return {
    version,
    definitions: await loadDefinitions(version.id, db),
    isOpen: isVersionOpen(version, version),
  }
}

export async function listCodebookVersions(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<CodebookVersionSummary[]> {
  const versions = await db
    .select({ ...versionColumns, authorName: profiles.name })
    .from(codebookVersions)
    .innerJoin(profiles, eq(profiles.id, codebookVersions.createdBy))
    .where(eq(codebookVersions.projectId, projectId))
    .orderBy(desc(codebookVersions.versionNumber))

  const latest = versions[0] ?? null
  return versions.map((version) => summarize(version, latest))
}

export async function loadCodebookVersion(
  projectId: string,
  versionId: string,
  db: DbExecutor = ownerDb,
): Promise<CodebookVersionDetail | null> {
  if (!isUuid(versionId)) return null

  const [version] = await db
    .select({ ...versionColumns, authorName: profiles.name })
    .from(codebookVersions)
    .innerJoin(profiles, eq(profiles.id, codebookVersions.createdBy))
    .where(
      and(
        eq(codebookVersions.id, versionId),
        eq(codebookVersions.projectId, projectId),
      ),
    )
    .limit(1)

  if (!version) return null

  return {
    version: summarize(version, await latestVersion(projectId, db)),
    definitions: await loadDefinitions(version.id, db),
  }
}
