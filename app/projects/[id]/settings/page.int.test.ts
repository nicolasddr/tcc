// app/projects/[id]/settings/page.int.test.ts — teste de integração do ESCOPO da página
// de configurações do projeto. Ela concentra edição, status e onboarding, então o portão
// é mais estreito que o da página do projeto: só o Administrador ATIVO entra; para todo o
// resto (avaliador do projeto inclusive) a página não existe.
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

import ProjectSettingsPage from '@/app/projects/[id]/settings/page'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  cleanup,
} from '@/test/helpers'

function render(id: string) {
  return ProjectSettingsPage({ params: Promise.resolve({ id }) })
}

describe('app/projects/[id]/settings — só o Administrador configura', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
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

  it('o Administrador do projeto enxerga', async () => {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin)
    projs.push(project)

    auth.userId = admin
    await expect(render(project)).resolves.toBeTruthy()
  })

  it('o avaliador do projeto NÃO enxerga (notFound)', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await seedProject(ownerDb, admin)
    projs.push(project)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('quem não participa NÃO enxerga (notFound)', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('De Fora')
    const project = await seedProject(ownerDb, admin)
    projs.push(project)

    auth.userId = outsider
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })
})
