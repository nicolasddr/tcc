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

import { AppTopBar } from '@/app/components/app-top-bar'
import { NotificationBell, type InboxItem } from '@/app/components/notification-bell'
import { ownerDb } from '@/lib/db'
import { createUser, addNotification, cleanup } from '@/test/helpers'

function find(node: unknown, match: (el: ReactElement) => boolean): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, match)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  if (match(node)) return node
  for (const value of Object.values(node.props as Record<string, unknown>)) {
    const found = find(value, match)
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

function propsOf(el: ReactElement | null): Record<string, unknown> {
  expect(el).not.toBeNull()
  return el!.props as Record<string, unknown>
}

describe('app/components/app-top-bar — barra do topo das telas logadas', () => {
  let users: string[]

  beforeEach(() => {
    users = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup([], users)
  })

  it('leva o sino com as notificações do usuário e o avatar com o nome', async () => {
    const user = await createUser(ownerDb, 'Ana Lima')
    users.push(user)
    await addNotification(ownerDb, user)

    auth.userId = user
    const tree = await AppTopBar({ trail: [{ label: 'Meus projetos' }] })

    const items = propsOf(find(tree, (el) => el.type === NotificationBell)).items as InboxItem[]
    expect(items).toHaveLength(1)
    expect(items[0].read).toBe(false)

    const profile = find(tree, (el) => (el.props as { href?: string }).href === '/profile')
    expect(propsOf(profile).title).toBe('Editar meu perfil')
    expect(textOf(profile)).toContain('Ana Lima')
  })

  it('liga os itens da trilha, menos o último, que marca a página atual', async () => {
    const user = await createUser(ownerDb)
    users.push(user)

    auth.userId = user
    const tree = await AppTopBar({
      trail: [
        { label: 'Meus projetos', href: '/dashboard' },
        { label: 'Meu perfil' },
      ],
    })

    const nav = find(tree, (el) => (el.props as { 'aria-label'?: string })['aria-label'] === 'Trilha')
    expect(find(nav, (el) => (el.props as { href?: string }).href === '/dashboard')).not.toBeNull()
    const current = find(nav, (el) => (el.props as { 'aria-current'?: string })['aria-current'] === 'page')
    expect(textOf(current)).toBe('Meu perfil')
  })

  it('manda para o login quem não está logado', async () => {
    await expect(AppTopBar({ trail: [] })).rejects.toThrow('NEXT_REDIRECT:/login')
  })
})
