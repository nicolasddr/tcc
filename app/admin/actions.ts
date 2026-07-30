'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, platformPermissionRequests, profiles } from '@/lib/db'
import { isSuperAdmin } from '@/lib/authz'
import { emitPermissionDecisionNotification } from '@/lib/notifications/permission'


async function resolvePermissionRequest(
  formData: FormData,
  decision: 'approved' | 'rejected',
): Promise<void> {
  const adminId = await requireUserId()

  const requestId = String(formData.get('request_id') ?? '')
  if (!requestId) return

  if (!(await isSuperAdmin(adminId))) return

  await transaction(async (tx) => {
    const resolved = await tx
      .update(platformPermissionRequests)
      .set({
        status: decision,
        resolvedBy: adminId,
        resolvedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(platformPermissionRequests.id, requestId),
          eq(platformPermissionRequests.status, 'pending'),
        ),
      )
      .returning({ userId: platformPermissionRequests.userId })


    if (resolved.length === 0) return
    const requesterId = resolved[0].userId

    if (decision === 'approved') {
      await tx
        .update(profiles)
        .set({ canCreateProjects: true })
        .where(eq(profiles.id, requesterId))
    }

    await emitPermissionDecisionNotification(tx, requesterId, decision)
  })

  revalidatePath('/admin/permissions')
  revalidatePath('/dashboard')
}

export async function approvePermissionRequest(formData: FormData): Promise<void> {
  await resolvePermissionRequest(formData, 'approved')
}

export async function rejectPermissionRequest(formData: FormData): Promise<void> {
  await resolvePermissionRequest(formData, 'rejected')
}
