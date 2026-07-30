'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, notifications } from '@/lib/db'

// HU-010/011: marcar uma notificação como lida. O escopo "own" é EXPLÍCITO na app (o
// WHERE filtra por `userId`): o usuário só toca o próprio inbox, mesmo que o id venha
// adulterado do cliente. Ver ADR 0007.
export async function markNotificationRead(formData: FormData): Promise<void> {
  const userId = await requireUserId()

  const id = String(formData.get('notification_id') ?? '')
  if (!id) return

  await transaction((tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        ),
      ),
  )

  revalidatePath('/dashboard')
}

// Marca todas as notificações ainda não lidas do usuário como lidas de uma vez. Escopo
// "own" explícito (WHERE user_id = userId).
export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId()

  await transaction((tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  )

  revalidatePath('/dashboard')
}
