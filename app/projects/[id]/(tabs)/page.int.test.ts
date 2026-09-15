// app/projects/[id]/(tabs)/page.int.test.ts — teste de integração do ESCOPO de visibilidade
// da página do projeto (issue #22). "Quem não participa não enxerga o projeto": prova a
// checagem EXPLÍCITA (`canView` → notFound) que a página faz na app-layer.
//
// A página é um Server Component: renderizá-la aqui só monta a árvore de elementos
// (nenhum componente-cliente executa). Cada acesso commita via `transaction`, então as
// fixtures são gravadas por `ownerDb` e limpas por `cleanup()`.
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
  usePathname: () => '/',
}))

import ProjectPage from '@/app/projects/[id]/(tabs)/page'
import ProjectTabsLayout from '@/app/projects/[id]/(tabs)/layout'
import { ProjectTabs } from '@/app/projects/[id]/project-tabs'
import { PipelineChecklist } from '@/app/projects/[id]/pipeline/pipeline-checklist'
import { AdvancePhase } from '@/app/projects/[id]/pipeline/advance-phase'
import {
  PHASE_1,
  PHASE_2,
  pendingRequirements,
} from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
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

function hasProp(node: unknown, key: string, value: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => hasProp(child, key, value))
  if (!isValidElement(node)) return false
  const props = node.props as Record<string, unknown>
  if (props[key] === value) return true
  return Object.values(props).some((child) => hasProp(child, key, value))
}

type ChecklistProps = Parameters<typeof PipelineChecklist>[0]
type TabsProps = Parameters<typeof ProjectTabs>[0]
type AdvanceProps = Parameters<typeof AdvancePhase>[0]

function render(id: string) {
  return ProjectPage({ params: Promise.resolve({ id }) })
}

function renderLayout(id: string) {
  return ProjectTabsLayout({ params: Promise.resolve({ id }), children: null })
}

function checklistOf(tree: unknown): ChecklistProps | null {
  const element = findElement(tree, PipelineChecklist)
  return element ? (element.props as ChecklistProps) : null
}

function advanceOf(tree: unknown): ReactElement | null {
  const props = checklistOf(tree)
  if (!props) return null
  return findElement(PipelineChecklist(props), AdvancePhase)
}

describe('app/projects/[id]/page — escopo de visibilidade', () => {
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

  async function tabsOf(projectId: string, userId: string) {
    auth.userId = userId
    const tabs = findElement(await renderLayout(projectId), ProjectTabs)
    expect(tabs).toBeTruthy()
    return ProjectTabs(tabs!.props as TabsProps)
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('quem não participa não enxerga o projeto (notFound)', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)

    auth.userId = outsider
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
    await expect(renderLayout(project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o criador/admin, um membro e um convidado pendente enxergam', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const invited = await newUser('Convidado')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    await addPendingInvitation(ownerDb, project, invited, admin)

    for (const userId of [admin, evaluator, invited]) {
      auth.userId = userId
      await expect(render(project)).resolves.toBeTruthy()
      await expect(renderLayout(project)).resolves.toBeTruthy()
    }
  })

  it('o Administrador vê o checklist de avanço, e cada pendência aponta a tela do artefato', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const tree = await render(project)
    const props = checklistOf(tree)
    expect(props).toBeTruthy()

    const pending = pendingRequirements(props!.inputs)
    expect(pending.map((r) => r.key)).toEqual(['definition', 'prompt', 'item'])

    const rendered = PipelineChecklist(props!)
    for (const req of pending) {
      expect(hasProp(rendered, 'href', `/projects/${project}/${req.route}`)).toBe(true)
    }
  })

  it('cada insumo já cadastrado resolve a sua pendência no checklist', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin, { name: 'Consulta 001' })

    auth.userId = admin
    const props = checklistOf(await render(project))!
    expect(props.inputs.promptText).toBe('Classifique a consulta.')
    expect(props.inputs.items).toBe(1)
    expect(pendingRequirements(props.inputs).map((r) => r.key)).toEqual(['definition'])
  })

  it('com os três insumos o avanço fica disponível, e some depois da Fase 1', async () => {
    const admin = await newUser('Admin')
    const phase1 = await newProject(admin)
    const phase2 = await newProject(admin, PHASE_2)

    for (const project of [phase1, phase2]) {
      await addCodebookVersion(ownerDb, project, admin)
      await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
      await addInputItem(ownerDb, project, admin)
    }

    auth.userId = admin
    const liberado = advanceOf(await render(phase1))!.props as AdvanceProps
    expect(liberado.phase).toBe(PHASE_1)
    expect(liberado.pending).toEqual([])

    const avancado = advanceOf(await render(phase2))!.props as AdvanceProps
    expect(avancado.phase).toBe(PHASE_2)
  })

  it('o botão de avançar fase da barra leva ao checklist da própria tela', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const phase1 = await newProject(admin)
    const phase2 = await newProject(admin, PHASE_2)
    await addActiveEvaluator(ownerDb, phase1, evaluator)

    async function overview(id: string, userId: string) {
      auth.userId = userId
      return render(id)
    }

    expect(hasProp(await overview(phase1, admin), 'href', '#avancar')).toBe(true)
    expect(hasProp(await overview(phase2, admin), 'href', '#avancar')).toBe(false)
    expect(hasProp(await overview(phase1, evaluator), 'href', '#avancar')).toBe(false)
  })

  it('o avaliador não vê o checklist nem os resumos dos artefatos', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const tree = await render(project)
    expect(checklistOf(tree)).toBeNull()
    expect(hasProp(tree, 'href', `/projects/${project}/codebook`)).toBe(false)
  })

  it('a visão geral vista pelo avaliador não fala de concordância', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin, PHASE_2)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const page = deepText(await render(project))

    expect(page).not.toContain('Krippendorff')
    expect(page).not.toContain('ICR')
    expect(page).not.toContain('Concordância')
  })

  it('a visão geral resume codebook, prompt e itens com link para cada tela', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category' },
        { title: 'Transacional', type: 'category' },
      ],
    })
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin)

    auth.userId = admin
    const tree = await render(project)

    for (const route of ['codebook', 'prompt', 'items']) {
      expect(hasProp(tree, 'href', `/projects/${project}/${route}`)).toBe(true)
    }
  })

  it('as abas por artefato são do Administrador; Membros é um chip fora das abas', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    const adminTabs = await tabsOf(project, admin)
    const evaluatorTabs = await tabsOf(project, evaluator)

    for (const route of ['codebook', 'prompt', 'items']) {
      const href = `/projects/${project}/${route}`
      expect(hasProp(adminTabs, 'href', href)).toBe(true)
      expect(hasProp(evaluatorTabs, 'href', href)).toBe(false)
    }

    const members = `/projects/${project}/members`
    for (const tabs of [adminTabs, evaluatorTabs]) {
      expect(hasProp(tabs, 'href', members)).toBe(false)
      expect(hasProp(tabs, 'href', `/projects/${project}/pipeline`)).toBe(false)
    }

    for (const userId of [admin, evaluator]) {
      auth.userId = userId
      expect(hasProp(await renderLayout(project), 'href', members)).toBe(true)
    }
  })
})
