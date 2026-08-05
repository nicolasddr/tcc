// app/profile/actions.int.test.ts — teste de integração da Server Action de perfil
// (issue #22). Prova o escopo "own" EXPLÍCITO: o usuário edita só o PRÓPRIO nome (o WHERE
// é `id = userId`), sem tocar no de outro.
//
// A action commita via `transaction`: fixtures via `ownerDb`, limpas por `cleanup()`.
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'

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

import { updateProfile } from '@/app/profile/actions'
import { ownerDb, profiles } from '@/lib/db'
import { createUser, cleanup } from '@/test/helpers'

function fd(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

describe('app/profile/actions — o usuário edita só o próprio nome', () => {
  let users: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function nameOf(id: string): Promise<string> {
    const [row] = await ownerDb
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, id))
    return row.name
  }

  beforeEach(() => {
    users = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup([], users)
  })

  it('updateProfile: atualiza o próprio nome e não toca no de outro', async () => {
    const a = await newUser('Ana')
    const b = await newUser('Bruno')

    auth.userId = a
    const res = await updateProfile(null, fd({ name: 'Ana Editada' }))
    expect(res).toEqual({ ok: expect.any(String) })
    expect(await nameOf(a)).toBe('Ana Editada')
    expect(await nameOf(b)).toBe('Bruno')
  })

  it('updateProfile: nome vazio → erro, sem alterar', async () => {
    const a = await newUser('Ana')
    auth.userId = a
    const res = await updateProfile(null, fd({ name: '   ' }))
    expect(res).toEqual({ error: expect.any(String) })
    expect(await nameOf(a)).toBe('Ana')
  })
})
