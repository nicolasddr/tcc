import { asc, desc, eq } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  codebookVersions,
  codebookDefinitions,
} from '@/lib/db'
import { isVersionOpen } from '@/lib/versioning'

export type CodebookVersion = {
  id: string
  versionNumber: number
  note: string | null
  createdAt: string
  updatedAt: string | null
  usedAt: string | null
}

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

export async function loadCodebook(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<Codebook> {
  const [version] = await db
    .select({
      id: codebookVersions.id,
      versionNumber: codebookVersions.versionNumber,
      note: codebookVersions.note,
      createdAt: codebookVersions.createdAt,
      updatedAt: codebookVersions.updatedAt,
      usedAt: codebookVersions.usedAt,
    })
    .from(codebookVersions)
    .where(eq(codebookVersions.projectId, projectId))
    .orderBy(desc(codebookVersions.versionNumber))
    .limit(1)

  if (!version) return { version: null, definitions: [], isOpen: true }

  const definitions = await db
    .select({
      id: codebookDefinitions.id,
      title: codebookDefinitions.title,
      type: codebookDefinitions.type,
      orderIndex: codebookDefinitions.orderIndex,
    })
    .from(codebookDefinitions)
    .where(eq(codebookDefinitions.codebookVersionId, version.id))
    .orderBy(asc(codebookDefinitions.orderIndex))

  return { version, definitions, isOpen: isVersionOpen(version, version) }
}
