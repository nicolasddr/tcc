// app/notifications/actions.int.test.ts — testes de integração das Server Actions de
// notificações (issue #22, Fase 1, commit 9). Provam o escopo "own" EXPLÍCITO: o usuário
// só marca como lidas as PRÓPRIAS notificações, mesmo passando o id de outra — com a RLS
// de backstop (espelha notifications_update_own).
//
// Cada action commita via `withUser`: fixtures via `ownerDb`, limpas por `cleanup()`
// (deletar os usuários cascateia as notificações). PRÉ-REQUISITO: Supabase LOCAL de pé.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', () => ({
  getClaims: async () => (auth.userId ? { sub: auth.userId } : null),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import { markNotificationRead, markAllNotificationsRead } from '@/app/notifications/actions'
import { ownerDb, notifications } from '@/lib/db'
import { createUser, addNotification, cleanup } from '@/test/helpers'

function fd(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

describe('app/notifications/actions — escopo "own" explícito', () => {
  let users: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function readAtOf(id: string): Promise<string | null> {
    const [row] = await ownerDb
      .select({ readAt: notifications.readAt })
      .from(notifications)
      .where(eq(notifications.id, id))
    return row.readAt
  }

  beforeEach(() => {
    users = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup([], users)
  })

  it('markNotificationRead: não marca a notificação de outro; marca a própria', async () => {
    const a = await newUser('A')
    const b = await newUser('B')
    const nA = await addNotification(ownerDb, a)
    const nB = await addNotification(ownerDb, b)

    auth.userId = a
    await markNotificationRead(fd({ notification_id: nB }))
    expect(await readAtOf(nB)).toBeNull()

    await markNotificationRead(fd({ notification_id: nA }))
    expect(await readAtOf(nA)).not.toBeNull()
  })

  it('markAllNotificationsRead: só marca as próprias', async () => {
    const a = await newUser('A')
    const b = await newUser('B')
    const nA = await addNotification(ownerDb, a)
    const nB = await addNotification(ownerDb, b)

    auth.userId = a
    await markAllNotificationsRead()
    expect(await readAtOf(nA)).not.toBeNull()
    expect(await readAtOf(nB)).toBeNull()
  })
})
