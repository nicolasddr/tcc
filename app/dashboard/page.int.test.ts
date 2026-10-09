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

import Dashboard from '@/app/dashboard/page'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  cleanup,
} from '@/test/helpers'

function render() {
  return Dashboard({ searchParams: Promise.resolve({}) })
}

function findByHref(node: unknown, href: string): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByHref(child, href)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const props = node.props as Record<string, unknown>
  if (props.href === href) return node
  for (const value of Object.values(props)) {
    const found = findByHref(value, href)
    if (found) return found
  }
  return null
}

function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (!isValidElement(node)) return ''
  return textOf((node.props as { children?: unknown }).children)
}

function cardTextOf(tree: unknown, projectId: string): string {
  const link = findByHref(tree, `/projects/${projectId}`)
  expect(link).not.toBeNull()
  return textOf(link).replace(/\s+/g, ' ').trim()
}

describe('app/dashboard — fase de cada projeto', () => {
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

  it('mostra a fase ao lado do papel', async () => {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto na Fase 1')
    projs.push(project)

    auth.userId = admin
    const text = cardTextOf(await render(), project)

    expect(text).toContain('Administrador · Fase 1 de 4, Configuração inicial')
  })

  it('junta os papéis e a fase de cada projeto', async () => {
    const admin = await newUser('Admin')
    const other = await newUser('Outro')
    const both = await seedProject(ownerDb, admin, 'Projeto na Fase 3', { phase: 3 })
    const evaluatorOnly = await seedProject(ownerDb, other, 'Projeto na Fase 4', { phase: 4 })
    projs.push(both, evaluatorOnly)
    await addActiveEvaluator(ownerDb, both, admin)
    await addActiveEvaluator(ownerDb, evaluatorOnly, admin)

    auth.userId = admin
    const tree = await render()

    expect(cardTextOf(tree, both)).toContain(
      'Administrador · Avaliador · Fase 3 de 4, Validação do prompt',
    )
    expect(cardTextOf(tree, evaluatorOnly)).toContain('Avaliador · Fase 4 de 4, Validação final')
  })
})
