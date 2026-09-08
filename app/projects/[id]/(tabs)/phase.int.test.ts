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

import ProjectPage from '@/app/projects/[id]/(tabs)/page'
import { PhaseBar, PROJECT_PHASES } from '@/app/projects/[id]/phase-bar'
import { ownerDb, projects, pgErrorCode } from '@/lib/db'
import { eq } from 'drizzle-orm'
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

async function renderPhase(id: string): Promise<number | undefined> {
  const tree = await ProjectPage({ params: Promise.resolve({ id }) })
  const bar = findElement(tree, PhaseBar)
  return (bar?.props as { current?: number } | undefined)?.current
}

describe('app/projects/[id] — a barra de fases lê a fase do projeto', () => {
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

  it('projeto novo nasce na Fase 1', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await expect(renderPhase(project)).resolves.toBe(1)
  })

  it('projeto semeado em fase diferente de 1 aparece na fase certa', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, 3)

    auth.userId = admin
    await expect(renderPhase(project)).resolves.toBe(3)
  })

  it('mudar a fase do projeto muda o que a barra mostra', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await expect(renderPhase(project)).resolves.toBe(1)

    await ownerDb.update(projects).set({ phase: 2 }).where(eq(projects.id, project))
    await expect(renderPhase(project)).resolves.toBe(2)
  })

  it('a fase aceita de 1 até a última do processo, e recusa fora disso', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    for (let phase = 1; phase <= PROJECT_PHASES.length; phase++) {
      await ownerDb.update(projects).set({ phase }).where(eq(projects.id, project))
      auth.userId = admin
      await expect(renderPhase(project)).resolves.toBe(phase)
    }

    for (const phase of [0, PROJECT_PHASES.length + 1]) {
      const err = await ownerDb
        .update(projects)
        .set({ phase })
        .where(eq(projects.id, project))
        .then(() => null)
        .catch((e: unknown) => e)
      expect(pgErrorCode(err)).toBe('23514')
    }
  })
})
