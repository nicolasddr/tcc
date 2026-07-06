'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { withUser, notifications } from '@/lib/db'

// HU-010/011: marcar uma notificação como lida. O UPDATE passa por `withUser` (papel
// `authenticated`), então a RLS (notifications_update_own) e o grant por coluna (só
// read_at) continuam garantindo que o usuário só toca o próprio inbox — ver ADR 0007.
export async function markNotificationRead(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const id = String(formData.get('notification_id') ?? '')
  if (!id) return

  await withUser(userId, (tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(notifications.id, id), isNull(notifications.readAt))),
  )

  revalidatePath('/dashboard')
}

// Marca todas as notificações ainda não lidas do usuário como lidas de uma vez.
export async function markAllNotificationsRead(): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  await withUser(userId, (tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  )

  revalidatePath('/dashboard')
}
