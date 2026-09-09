import { asc, count, eq } from 'drizzle-orm'
import { ownerDb, type DbExecutor, inputItems } from '@/lib/db'
import { isUsed } from '@/lib/versioning'
import { loadItemRoundUsage } from './responses'

export type InputItem = {
  id: string
  name: string
  content: string
  createdAt: string
  updatedAt: string | null
  usedAt: string | null
  isEditable: boolean
  roundNumbers: number[]
}

export async function loadItems(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<InputItem[]> {
  const rows = await db
    .select({
      id: inputItems.id,
      name: inputItems.name,
      content: inputItems.content,
      createdAt: inputItems.createdAt,
      updatedAt: inputItems.updatedAt,
      usedAt: inputItems.usedAt,
    })
    .from(inputItems)
    .where(eq(inputItems.projectId, projectId))
    .orderBy(asc(inputItems.createdAt))

  const usage = await loadItemRoundUsage(projectId, db)

  return rows.map((row) => ({
    ...row,
    isEditable: !isUsed(row),
    roundNumbers: usage.get(row.id) ?? [],
  }))
}

export async function countItems(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(inputItems)
    .where(eq(inputItems.projectId, projectId))

  return row?.value ?? 0
}
