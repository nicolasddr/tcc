import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  profiles,
  codebookVersions,
  codebookDefinitions,
  codebookCriteria,
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

export type CodebookVersionCounts = {
  definitionCount: number
  criterionCount: number
}

export type CodebookVersionSummary = Summarized<
  CodebookVersion & { authorName: string } & CodebookVersionCounts
>

export type CodebookDefinition = {
  id: string
  title: string
  type: string
  description: string | null
  orderIndex: number
}

export type CodebookCriterion = {
  id: string
  definitionId: string | null
  name: string
  description: string | null
  orderIndex: number
}

export type Codebook = {
  version: CodebookVersion | null
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  isOpen: boolean
}

export type CodebookVersionDetail = {
  version: CodebookVersionSummary
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
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
      description: codebookDefinitions.description,
      orderIndex: codebookDefinitions.orderIndex,
    })
    .from(codebookDefinitions)
    .where(eq(codebookDefinitions.codebookVersionId, versionId))
    .orderBy(asc(codebookDefinitions.orderIndex))
}

function loadCriteria(
  versionId: string,
  db: DbExecutor,
): Promise<CodebookCriterion[]> {
  return db
    .select({
      id: codebookCriteria.id,
      definitionId: codebookCriteria.definitionId,
      name: codebookCriteria.name,
      description: codebookCriteria.description,
      orderIndex: codebookCriteria.orderIndex,
    })
    .from(codebookCriteria)
    .where(eq(codebookCriteria.codebookVersionId, versionId))
    .orderBy(asc(codebookCriteria.orderIndex), asc(codebookCriteria.id))
}

export async function loadCodebook(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<Codebook> {
  const version = await latestVersion(projectId, db)

  if (!version) {
    return { version: null, definitions: [], criteria: [], isOpen: true }
  }

  return {
    version,
    definitions: await loadDefinitions(version.id, db),
    criteria: await loadCriteria(version.id, db),
    isOpen: isVersionOpen(version, version),
  }
}

async function countsOf(
  versionIds: string[],
  db: DbExecutor,
): Promise<Map<string, CodebookVersionCounts>> {
  const counts = new Map<string, CodebookVersionCounts>(
    versionIds.map((id) => [id, { definitionCount: 0, criterionCount: 0 }]),
  )
  if (versionIds.length === 0) return counts

  const definitionRows = await db
    .select({
      versionId: codebookDefinitions.codebookVersionId,
      total: count(),
    })
    .from(codebookDefinitions)
    .where(inArray(codebookDefinitions.codebookVersionId, versionIds))
    .groupBy(codebookDefinitions.codebookVersionId)

  for (const row of definitionRows) {
    counts.get(row.versionId)!.definitionCount = row.total
  }

  const criterionRows = await db
    .select({
      versionId: codebookCriteria.codebookVersionId,
      total: count(),
    })
    .from(codebookCriteria)
    .where(inArray(codebookCriteria.codebookVersionId, versionIds))
    .groupBy(codebookCriteria.codebookVersionId)

  for (const row of criterionRows) {
    counts.get(row.versionId)!.criterionCount = row.total
  }

  return counts
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
  const counts = await countsOf(
    versions.map((version) => version.id),
    db,
  )

  return versions.map((version) =>
    summarize({ ...version, ...counts.get(version.id)! }, latest),
  )
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

  const counts = await countsOf([version.id], db)

  return {
    version: summarize(
      { ...version, ...counts.get(version.id)! },
      await latestVersion(projectId, db),
    ),
    definitions: await loadDefinitions(version.id, db),
    criteria: await loadCriteria(version.id, db),
  }
}
