import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isValidElement, type ReactElement } from 'react'
import { eq } from 'drizzle-orm'

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
  usePathname: () => '/',
}))

import ProjectTabsLayout from '@/app/projects/[id]/(tabs)/layout'
import { StatusBadge } from '@/app/components/ui/badge'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { PROJECT_PHASES, TOTAL_PHASES } from '@/app/projects/[id]/phase-bar'
import { ownerDb, projects } from '@/lib/db'
import { createUser, createProject as seedProject, cleanup } from '@/test/helpers'

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

function elementWithProp(node: unknown, key: string, value: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = elementWithProp(child, key, value)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const props = node.props as Record<string, unknown>
  if (props[key] === value) return node
  for (const child of Object.values(props)) {
    const found = elementWithProp(child, key, value)
    if (found) return found
  }
  return null
}

function deepText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return ` ${node} `
  if (Array.isArray(node)) return node.map(deepText).join('')
  if (isValidElement(node)) {
    return Object.values(node.props as Record<string, unknown>)
      .map(deepText)
      .join('')
  }
  return ''
}

function textOf(node: unknown): string {
  return deepText(node).replace(/\s+/g, ' ').trim()
}

function renderLayout(id: string) {
  return ProjectTabsLayout({ params: Promise.resolve({ id }), children: null })
}

describe('app/projects/[id]/(tabs)/layout — cabeçalho do projeto', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string, phase?: number): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
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

  it('o selo da fase leva à Visão geral e nomeia a fase atual', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, 3)

    auth.userId = admin
    const seal = elementWithProp(await renderLayout(project), 'href', `/projects/${project}`)
    expect(seal).toBeTruthy()
    expect(textOf(seal)).toContain(
      `Fase 3 de ${TOTAL_PHASES} · ${PROJECT_PHASES[2].name}`,
    )
  })

  it('o selo acompanha a fase gravada no projeto', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const before = elementWithProp(await renderLayout(project), 'href', `/projects/${project}`)
    expect(textOf(before)).toContain(`Fase 1 de ${TOTAL_PHASES} · ${PROJECT_PHASES[0].name}`)

    await ownerDb.update(projects).set({ phase: 2 }).where(eq(projects.id, project))
    const after = elementWithProp(await renderLayout(project), 'href', `/projects/${project}`)
    expect(textOf(after)).toContain(`Fase 2 de ${TOTAL_PHASES} · ${PROJECT_PHASES[1].name}`)
  })

  it('projeto ativo não mostra o selo "Ativo"', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const tree = await renderLayout(project)
    expect(findElement(tree, StatusBadge)).toBeNull()
    expect(textOf(tree)).not.toContain('Ativo')
  })

  it.each([
    ['completed', 'Concluído'],
    ['archived', 'Arquivado'],
  ] as const)('projeto %s mostra o selo "%s"', async (status, label) => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await ownerDb.update(projects).set({ status }).where(eq(projects.id, project))

    auth.userId = admin
    const badge = findElement(await renderLayout(project), StatusBadge)
    expect(badge).toBeTruthy()
    expect((badge!.props as { status: string }).status).toBe(status)
    expect(textOf((badge!.props as { children: unknown }).children)).toBe(label)
  })

  it('a descrição vira uma linha abaixo do título, com o texto inteiro no title', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const description = 'Classificar intenções de mensagens de clientes de um banco digital'
    await ownerDb.update(projects).set({ description }).where(eq(projects.id, project))

    auth.userId = admin
    const tree = await renderLayout(project)
    expect(findElement(tree, InfoTooltip)).toBeNull()
    const line = elementWithProp(tree, 'title', description)
    expect(line).toBeTruthy()
    expect(line!.type).toBe('p')
    expect(textOf((line!.props as { children: unknown }).children)).toBe(description)
    expect((line!.props as { className: string }).className).toContain('truncate')
  })

  it('sem descrição, não há linha vazia de descrição', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const tree = await renderLayout(project)
    expect(elementWithProp(tree, 'title', null)).toBeNull()
    expect(elementWithProp(tree, 'title', '')).toBeNull()
  })
})
