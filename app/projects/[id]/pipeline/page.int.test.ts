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

import ProjectPipelinePage from '@/app/projects/[id]/pipeline/page'
import { ownerDb } from '@/lib/db'
import { createUser, createProject as seedProject, cleanup } from '@/test/helpers'

function render(id: string) {
  return ProjectPipelinePage({ params: Promise.resolve({ id }) })
}

describe('app/projects/[id]/pipeline — a rota antiga volta para a visão geral', () => {
  let users: string[]
  let projs: string[]

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o Administrador que chega pelo link antigo cai na visão geral', async () => {
    const admin = await createUser(ownerDb, 'Admin')
    users.push(admin)
    const project = await seedProject(ownerDb, admin)
    projs.push(project)

    auth.userId = admin
    await expect(render(project)).rejects.toThrow(`NEXT_REDIRECT:/projects/${project}`)
  })

  it('o redirecionamento não depende de o projeto existir', async () => {
    const outsider = await createUser(ownerDb, 'De Fora')
    users.push(outsider)
    const missing = crypto.randomUUID()

    auth.userId = outsider
    await expect(render(missing)).rejects.toThrow(`NEXT_REDIRECT:/projects/${missing}`)
  })
})
