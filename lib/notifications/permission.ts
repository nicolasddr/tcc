import { type DbExecutor, notifications } from '@/lib/db'

export type PermissionDecision = 'approved' | 'rejected'


export async function emitPermissionDecisionNotification(
  db: DbExecutor,
  userId: string,
  result: PermissionDecision,
): Promise<void> {
  await db.insert(notifications).values({
    userId,
    type: 'permission_decision',
    payload: { result },
  })
}
