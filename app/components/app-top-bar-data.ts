import { cache } from 'react'
import { desc, eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { transaction, profiles, notifications } from '@/lib/db'
import {
  notificationText,
  formatDate,
  type NotificationPayload,
} from '@/app/notifications/labels'
import type { InboxItem } from './notification-bell'

export type TopBarData = {
  displayName: string
  email: string
  avatarUrl: string | undefined
  initial: string
  inbox: InboxItem[]
}

export const loadTopBar = cache(async (userId: string): Promise<TopBarData> => {
  const claims = await getClaims()
  const avatarUrl: string | undefined =
    claims?.user_metadata?.avatar_url ?? claims?.user_metadata?.picture
  const email = claims?.email ?? ''

  const { profileRows, notificationRows } = await transaction(async (tx) => {
    const profileRows = await tx
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)

    const notificationRows = await tx
      .select({
        id: notifications.id,
        type: notifications.type,
        payload: notifications.payload,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(30)

    return { profileRows, notificationRows }
  })

  return {
    displayName: profileRows[0]?.name ?? email,
    email,
    avatarUrl,
    initial: email.charAt(0),
    inbox: notificationRows.map((n) => ({
      id: n.id,
      text: notificationText(n.type, (n.payload ?? {}) as NotificationPayload),
      dateLabel: formatDate(n.createdAt),
      read: n.readAt != null,
    })),
  }
})
