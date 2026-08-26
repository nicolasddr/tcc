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

import ProjectPage from '@/app/projects/[id]/page'
import ProjectPipelinePage from '@/app/projects/[id]/pipeline/page'
import { ProjectTabs } from '@/app/projects/[id]/project-tabs'
import { PipelineChecklist } from '@/app/projects/[id]/pipeline/pipeline-checklist'
import { pendingRequirements } from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  addPendingInvitation,
  addPromptVersion,
  cleanup,
} from '@/test/helpers'

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

function hasProp(node: unknown, key: string, value: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => hasProp(child, key, value))
  if (!isValidElement(node)) return false
  const props = node.props as Record<string, unknown>
  if (props[key] === value) return true
  return Object.values(props).some((child) => hasProp(child, key, value))
}

type ChecklistProps = Parameters<typeof PipelineChecklist>[0]
type TabsProps = Parameters<typeof ProjectTabs>[0]

function render(id: string) {
  return ProjectPipelinePage({ params: Promise.resolve({ id }) })
}

describe('app/projects/[id]/pipeline — a aba de configuração é do Administrador', () => {
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

  it('o Administrador do projeto enxerga', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await expect(render(project)).resolves.toBeTruthy()
  })

  it('o avaliador ativo NÃO enxerga (notFound)', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('quem não é membro NÃO enxerga (notFound)', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('De Fora')
    const invited = await newUser('Convidado')
    const project = await newProject(admin)
    await addPendingInvitation(ownerDb, project, invited, admin)

    auth.userId = outsider
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
    auth.userId = invited
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('a recusa não distingue projeto existente de inexistente', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)

    auth.userId = outsider
    const existing = await render(project).catch((e: Error) => e.message)
    const missing = await render(crypto.randomUUID()).catch((e: Error) => e.message)
    expect(existing).toBe('NEXT_NOTFOUND')
    expect(missing).toBe(existing)
  })

  it('o membro com onboarding pendente é levado ao fluxo de entrada', async () => {
    const admin = await newUser('Admin')
    const pending = await newUser('Em Onboarding')
    const project = await newProject(admin)
    await addPendingMember(ownerDb, project, pending)

    auth.userId = pending
    await expect(render(project)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${project}/onboarding`,
    )
  })

  it('a aba nasce com as três pendências, e cada uma aponta para onde se resolve', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const tree = await render(project)
    const checklist = findElement(tree, PipelineChecklist)
    expect(checklist).toBeTruthy()

    const props = checklist!.props as ChecklistProps
    const pending = pendingRequirements(props.inputs)
    expect(pending.map((r) => r.key)).toEqual(['definition', 'prompt', 'item'])

    const rendered = PipelineChecklist(props)
    for (const req of pending) {
      expect(hasProp(rendered, 'href', `#${req.anchor}`)).toBe(true)
      expect(hasProp(tree, 'id', req.anchor)).toBe(true)
    }
  })

  it('o texto do prompt já escrito resolve a pendência do prompt', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })

    auth.userId = admin
    const checklist = findElement(await render(project), PipelineChecklist)
    const props = checklist!.props as ChecklistProps
    expect(props.inputs.promptText).toBe('Classifique a consulta.')
    expect(pendingRequirements(props.inputs).map((r) => r.key)).toEqual([
      'definition',
      'item',
    ])
  })

  it('a aba aparece na navegação do Administrador e não na do Avaliador', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const tabHref = `/projects/${project}/pipeline`

    async function tabsOf(userId: string) {
      auth.userId = userId
      const tree = await ProjectPage({ params: Promise.resolve({ id: project }) })
      const tabs = findElement(tree, ProjectTabs)
      expect(tabs).toBeTruthy()
      return ProjectTabs(tabs!.props as TabsProps)
    }

    expect(hasProp(await tabsOf(admin), 'href', tabHref)).toBe(true)
    expect(hasProp(await tabsOf(evaluator), 'href', tabHref)).toBe(false)
  })
})
