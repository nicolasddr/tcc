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

import ProfilePage from '@/app/profile/page'
import { AppTopBar, type TrailItem } from '@/app/components/app-top-bar'
import { BackLink, PageSubtitle } from '@/app/components/ui/shell'
import { ownerDb } from '@/lib/db'
import { createUser, createProject, cleanup } from '@/test/helpers'

function findElement(node: unknown, type: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  if (node.type === type) return node
  for (const value of Object.values(node.props as Record<string, unknown>)) {
    const found = findElement(value, type)
    if (found) return found
  }
  return null
}

function propsOf(el: ReactElement | null): Record<string, unknown> {
  expect(el).not.toBeNull()
  return el!.props as Record<string, unknown>
}

async function render(from?: string) {
  const tree = await ProfilePage({ searchParams: Promise.resolve(from ? { from } : {}) })
  const back = propsOf(findElement(tree, BackLink))
  const trail = propsOf(findElement(tree, AppTopBar)).trail as TrailItem[]
  const subtitle = propsOf(findElement(tree, PageSubtitle)).children
  return { back, trail, subtitle }
}

describe('app/profile — volta para onde o usuário estava', () => {
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

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  it('mostra só o email do usuário no subtítulo', async () => {
    auth.userId = await newUser()
    const { subtitle } = await render()
    expect(Array.isArray(subtitle) ? subtitle.join('') : subtitle).toMatch(/^Email: \S+@\S+$/)
  })

  it('sem origem, volta para Meus projetos', async () => {
    auth.userId = await newUser()
    const { back, trail } = await render()
    expect(back).toMatchObject({ href: '/dashboard', children: 'Voltar a Meus projetos' })
    expect(trail.map((t) => t.label)).toEqual(['Meus projetos', 'Meu perfil'])
  })

  it('vindo de um projeto do qual é membro, volta para a mesma página do projeto', async () => {
    const user = await newUser()
    const project = await createProject(ownerDb, user, 'Classificação de notícias')
    projs.push(project)
    auth.userId = user

    const from = `/projects/${project}/rounds?status=open`
    const { back, trail } = await render(from)
    expect(back).toMatchObject({
      href: from,
      children: 'Voltar ao projeto Classificação de notícias',
    })
    expect(trail).toEqual([
      { label: 'Meus projetos', href: '/dashboard' },
      { label: 'Classificação de notícias', href: `/projects/${project}` },
      { label: 'Meu perfil' },
    ])
  })

  it('não revela o nome de projeto do qual não é membro', async () => {
    const owner = await newUser()
    const project = await createProject(ownerDb, owner, 'Projeto alheio')
    projs.push(project)
    auth.userId = await newUser()

    const from = `/projects/${project}`
    const { back, trail } = await render(from)
    expect(back).toMatchObject({ href: from, children: 'Voltar à página anterior' })
    expect(trail.map((t) => t.label)).toEqual(['Meus projetos', 'Meu perfil'])
  })

  it('vindo das solicitações de permissão, volta para elas', async () => {
    auth.userId = await newUser()
    const { back, trail } = await render('/admin/permissions')
    expect(back).toMatchObject({
      href: '/admin/permissions',
      children: 'Voltar às solicitações de permissão',
    })
    expect(trail[1]).toEqual({ label: 'Solicitações de permissão', href: '/admin/permissions' })
  })

  it('ignora origem externa e cai em Meus projetos', async () => {
    auth.userId = await newUser()
    const { back } = await render('//exemplo.com/phishing')
    expect(back).toMatchObject({ href: '/dashboard', children: 'Voltar a Meus projetos' })
  })
})
