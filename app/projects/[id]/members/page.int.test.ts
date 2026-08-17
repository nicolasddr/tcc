// app/projects/[id]/members/page.int.test.ts — teste de integração do ESCOPO da página
// de membros. A lista de membros (HU-025) é de quem já participa ATIVAMENTE: o
// administrador e o avaliador ativo entram; quem ainda está em onboarding, o convidado
// pendente e quem não participa esbarram no notFound.
//
// Mesmas convenções de app/projects/[id]/page.int.test.ts: Server Component renderizado
// direto, fixtures gravadas por `ownerDb` e limpas por `cleanup()`.
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOTFOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import ProjectMembersPage from '@/app/projects/[id]/members/page'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  addPendingInvitation,
  cleanup,
} from '@/test/helpers'

function render(id: string) {
  return ProjectMembersPage({ params: Promise.resolve({ id }) })
}

describe('app/projects/[id]/members — só quem participa ativamente entra', () => {
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

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o Administrador e o avaliador ativo enxergam', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = admin
    await expect(render(project)).resolves.toBeTruthy()
    auth.userId = evaluator
    await expect(render(project)).resolves.toBeTruthy()
  })

  it('quem ainda está em onboarding NÃO enxerga (notFound)', async () => {
    const admin = await newUser('Admin')
    const pending = await newUser('Em Onboarding')
    const project = await newProject(admin)
    await addPendingMember(ownerDb, project, pending)

    auth.userId = pending
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o convidado pendente e quem não participa NÃO enxergam (notFound)', async () => {
    const admin = await newUser('Admin')
    const invited = await newUser('Convidado')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)
    await addPendingInvitation(ownerDb, project, invited, admin)

    auth.userId = invited
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
    auth.userId = outsider
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })
})
