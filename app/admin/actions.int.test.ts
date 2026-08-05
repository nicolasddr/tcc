// app/admin/actions.int.test.ts — testes de integração da fatia 08 (permissão de criar
// projetos): o usuário SOLICITA (requestCreatePermission) e o super-admin DECIDE
// (approve/reject). Provam o comportamento externo de autorização e os efeitos colaterais
// (flag can_create_projects + notificação da decisão).
//
// Como as actions abrem a própria transação e COMMITAM, as fixtures são gravadas via
// `ownerDb` e removidas por `cleanup()`. PRÉ-REQUISITO: Supabase LOCAL de pé.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import { requestCreatePermission } from '@/app/projects/actions'
import { approvePermissionRequest, rejectPermissionRequest } from '@/app/admin/actions'
import { ownerDb, profiles, platformPermissionRequests, notifications } from '@/lib/db'
import {
  createUser,
  makeSuperAdmin,
  addPermissionRequest,
  grantCreatePermission,
  cleanup,
} from '@/test/helpers'

function fd(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

describe('fatia 08 — solicitação e decisão de permissão de criar projetos', () => {
  let users: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function pendingRequestOf(userId: string) {
    return ownerDb
      .select({
        id: platformPermissionRequests.id,
        status: platformPermissionRequests.status,
        resolvedBy: platformPermissionRequests.resolvedBy,
      })
      .from(platformPermissionRequests)
      .where(eq(platformPermissionRequests.userId, userId))
  }
  async function canCreateOf(userId: string): Promise<boolean> {
    const [row] = await ownerDb
      .select({ can: profiles.canCreateProjects })
      .from(profiles)
      .where(eq(profiles.id, userId))
    return row.can
  }
  async function decisionNotificationsOf(userId: string) {
    return ownerDb
      .select({ payload: notifications.payload })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.type, 'permission_decision')),
      )
  }

  beforeEach(() => {
    users = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup([], users)
  })

  it('requestCreatePermission: cria UMA pendente e é idempotente no re-clique', async () => {
    const u = await newUser('Solicitante')

    auth.userId = u
    const first = await requestCreatePermission(null, fd({}))
    expect(first).toEqual({ ok: expect.any(String) })

    // Segundo envio não cria uma segunda pendente (índice único parcial + onConflictDoNothing).
    await requestCreatePermission(null, fd({}))
    const rows = await pendingRequestOf(u)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
  })

  it('requestCreatePermission: quem já tem a permissão não gera solicitação', async () => {
    const u = await newUser('Já autorizado')
    await grantCreatePermission(ownerDb, u)

    auth.userId = u
    const res = await requestCreatePermission(null, fd({}))
    expect(res).toEqual({ ok: expect.any(String) })
    expect(await pendingRequestOf(u)).toHaveLength(0)
  })

  it('approvePermissionRequest: não-super-admin é no-op (fica pending, sem flag)', async () => {
    const requester = await newUser('Pede')
    const outro = await newUser('Qualquer um')
    const reqId = await addPermissionRequest(ownerDb, requester)

    auth.userId = outro // não é super-admin
    await approvePermissionRequest(fd({ request_id: reqId }))

    const [row] = await pendingRequestOf(requester)
    expect(row.status).toBe('pending')
    expect(await canCreateOf(requester)).toBe(false)
  })

  it('approvePermissionRequest: super-admin concede a flag e notifica', async () => {
    const requester = await newUser('Pede')
    const admin = await newUser('Super')
    await makeSuperAdmin(ownerDb, admin)
    const reqId = await addPermissionRequest(ownerDb, requester)

    auth.userId = admin
    await approvePermissionRequest(fd({ request_id: reqId }))

    const [row] = await pendingRequestOf(requester)
    expect(row.status).toBe('approved')
    expect(row.resolvedBy).toBe(admin)
    expect(await canCreateOf(requester)).toBe(true)

    const notes = await decisionNotificationsOf(requester)
    expect(notes).toHaveLength(1)
    expect((notes[0].payload as { result?: string }).result).toBe('approved')
  })

  it('rejectPermissionRequest: super-admin recusa sem conceder a flag, e notifica', async () => {
    const requester = await newUser('Pede')
    const admin = await newUser('Super')
    await makeSuperAdmin(ownerDb, admin)
    const reqId = await addPermissionRequest(ownerDb, requester)

    auth.userId = admin
    await rejectPermissionRequest(fd({ request_id: reqId }))

    const [row] = await pendingRequestOf(requester)
    expect(row.status).toBe('rejected')
    expect(await canCreateOf(requester)).toBe(false)

    const notes = await decisionNotificationsOf(requester)
    expect(notes).toHaveLength(1)
    expect((notes[0].payload as { result?: string }).result).toBe('rejected')
  })

  it('decisão é idempotente: aprovar de novo não re-decide nem re-notifica', async () => {
    const requester = await newUser('Pede')
    const admin = await newUser('Super')
    const admin2 = await newUser('Super 2')
    await makeSuperAdmin(ownerDb, admin)
    await makeSuperAdmin(ownerDb, admin2)
    const reqId = await addPermissionRequest(ownerDb, requester)

    auth.userId = admin
    await approvePermissionRequest(fd({ request_id: reqId }))
    // Segunda decisão (outro admin) sobre a MESMA solicitação: já não está pending.
    auth.userId = admin2
    await rejectPermissionRequest(fd({ request_id: reqId }))

    const [row] = await pendingRequestOf(requester)
    expect(row.status).toBe('approved') // permaneceu a 1ª decisão
    expect(row.resolvedBy).toBe(admin)
    expect(await canCreateOf(requester)).toBe(true)
    // Só a notificação da 1ª decisão.
    expect(await decisionNotificationsOf(requester)).toHaveLength(1)
  })
})
