// app/invitations/actions.int.test.ts — teste de integração da Server Action de recusa
// de convite (issue #22). Prova o escopo "own" EXPLÍCITO: só o próprio convidado recusa o
// seu convite pendente — mesmo passando o id de outro.
//
// Cada action commita via `transaction`: fixtures via `ownerDb`, limpas por `cleanup()`.
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`).
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

import { declineInvitation } from '@/app/invitations/actions'
import { ownerDb, projectInvitations } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addPendingInvitation,
  cleanup,
} from '@/test/helpers'

function fd(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

describe('app/invitations/actions — só o convidado recusa o próprio convite', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string): Promise<string> {
    const id = await seedProject(ownerDb, admin)
    projs.push(id)
    return id
  }
  async function statusOf(id: string): Promise<string> {
    const [row] = await ownerDb
      .select({ status: projectInvitations.status })
      .from(projectInvitations)
      .where(eq(projectInvitations.id, id))
    return row.status
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('outro usuário não recusa o convite alheio; o convidado recusa o próprio', async () => {
    const admin = await newUser('Admin')
    const invited = await newUser('Convidado')
    const other = await newUser('Outro')
    const project = await newProject(admin)
    const invitation = await addPendingInvitation(ownerDb, project, invited, admin)

    // Outro usuário tentando recusar o convite do convidado → segue pendente.
    auth.userId = other
    await declineInvitation(fd({ invitation_id: invitation }))
    expect(await statusOf(invitation)).toBe('pending')

    // O próprio convidado recusa.
    auth.userId = invited
    await declineInvitation(fd({ invitation_id: invitation }))
    expect(await statusOf(invitation)).toBe('declined')
  })
})
