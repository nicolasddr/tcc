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
import { PromptTest } from '@/app/projects/[id]/pipeline/prompt-test'
import { AdvancePhase } from '@/app/projects/[id]/pipeline/advance-phase'
import {
  PHASE_1,
  PHASE_2,
  pendingRequirements,
} from '@/app/projects/[id]/pipeline/preconditions'
import { llmModel } from '@/lib/ai'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  addPendingInvitation,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
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
type PromptTestProps = Parameters<typeof PromptTest>[0]
type AdvanceProps = Parameters<typeof AdvancePhase>[0]

function render(id: string) {
  return ProjectPipelinePage({ params: Promise.resolve({ id }) })
}

function advanceOf(tree: unknown): ReactElement | null {
  const checklist = findElement(tree, PipelineChecklist)
  if (!checklist) return null
  return findElement(PipelineChecklist(checklist.props as ChecklistProps), AdvancePhase)
}

describe('app/projects/[id]/pipeline — a aba de configuração é do Administrador', () => {
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

  it('o item de entrada já cadastrado resolve a pendência do item', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addInputItem(ownerDb, project, admin, { name: 'Consulta 001' })

    auth.userId = admin
    const checklist = findElement(await render(project), PipelineChecklist)
    const props = checklist!.props as ChecklistProps
    expect(props.inputs.items).toBe(1)
    expect(pendingRequirements(props.inputs).map((r) => r.key)).toEqual([
      'definition',
      'prompt',
    ])
  })

  it('o teste de prompt fica indisponível enquanto faltar definição, prompt ou item', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin, { name: 'Consulta 001' })

    auth.userId = admin
    const test = findElement(await render(project), PromptTest)
    expect(test).toBeTruthy()
    expect((test!.props as PromptTestProps).ready).toBe(false)
  })

  it('com os três insumos, o teste libera e mostra o modelo e o pool de itens', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin, { name: 'Consulta 001' })

    auth.userId = admin
    const props = findElement(await render(project), PromptTest)!
      .props as PromptTestProps
    expect(props.ready).toBe(true)
    expect(props.model).toBe(llmModel())
    expect(props.items.map((item) => item.name)).toEqual(['Consulta 001'])
  })

  it('o avanço fica indisponível e nomeia as pendências enquanto faltar insumo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })

    auth.userId = admin
    const advance = advanceOf(await render(project))
    expect(advance).toBeTruthy()

    const props = advance!.props as AdvanceProps
    expect(props.phase).toBe(PHASE_1)
    expect(props.projectId).toBe(project)
    expect(props.pending.map((r) => r.key)).toEqual(['definition', 'item'])
  })

  it('com os três insumos, o avanço fica disponível e sem pendência a listar', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin)

    auth.userId = admin
    const props = advanceOf(await render(project))!.props as AdvanceProps
    expect(props.pending).toEqual([])
  })

  it('depois do avanço a aba continua acessível, e não oferece avançar de novo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    await addCodebookVersion(ownerDb, project, admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin)

    auth.userId = admin
    const tree = await render(project)
    expect(tree).toBeTruthy()

    const props = advanceOf(tree)!.props as AdvanceProps
    expect(props.phase).toBe(PHASE_2)
    expect(props.phase).not.toBe(PHASE_1)

    const checklist = findElement(tree, PipelineChecklist)!
    const rendered = PipelineChecklist(checklist.props as ChecklistProps)
    expect(hasProp(rendered, 'children', 'Fase 1 concluída')).toBe(true)
  })

  it('a barra de fases da visão geral leva o Administrador ao avanço, só na Fase 1', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const phase1 = await newProject(admin)
    const phase2 = await newProject(admin, PHASE_2)
    await addActiveEvaluator(ownerDb, phase1, evaluator)

    async function overview(id: string, userId: string) {
      auth.userId = userId
      return ProjectPage({ params: Promise.resolve({ id }) })
    }

    expect(
      hasProp(await overview(phase1, admin), 'href', `/projects/${phase1}/pipeline#avancar`),
    ).toBe(true)
    expect(
      hasProp(await overview(phase2, admin), 'href', `/projects/${phase2}/pipeline#avancar`),
    ).toBe(false)
    expect(
      hasProp(await overview(phase1, evaluator), 'href', `/projects/${phase1}/pipeline#avancar`),
    ).toBe(false)
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
