'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// HU-010/011: marcar uma notificação como lida. A RLS (notifications_update_own) e o
// grant por coluna (só read_at) garantem que o usuário só toca o próprio inbox.
export async function markNotificationRead(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = String(formData.get('notification_id') ?? '')
  if (!id) return

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)

  revalidatePath('/dashboard')
}

// Marca todas as notificações ainda não lidas do usuário como lidas de uma vez.
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  revalidatePath('/dashboard')
}
