// app/projects/[id]/(tabs)/settings/page.int.test.ts — teste de integração do ESCOPO da página
// de configurações do projeto. Ela concentra edição, status e onboarding, então o portão
// é mais estreito que o da página do projeto: só o Administrador ATIVO entra; para todo o
// resto (avaliador do projeto inclusive) a página não existe.
//
// Mesmas convenções de app/projects/[id]/page.int.test.ts: Server Component renderizado
// direto, fixtures gravadas por `ownerDb` e limpas por `cleanup()`.
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isValidElement, type ReactElement } from 'react'

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

import ProjectSettingsPage from '@/app/projects/[id]/(tabs)/settings/page'
import { Section } from '@/app/components/ui/section'
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

function findAll(node: unknown, type: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type))
  if (!isValidElement(node)) return []
  const own = node.type === type ? [node] : []
  return [
    ...own,
    ...Object.values(node.props as Record<string, unknown>).flatMap((value) =>
      findAll(value, type),
    ),
  ]
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

  it('não repete a equipe do projeto, que tem a aba Membros', async () => {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin)
    projs.push(project)

    auth.userId = admin
    const titles = findAll(await render(project), Section).map(
      (section) => (section.props as { title: unknown }).title,
    )
    expect(titles).toContain('Onboarding dos avaliadores')
    expect(titles).not.toContain('Equipe do projeto')
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
