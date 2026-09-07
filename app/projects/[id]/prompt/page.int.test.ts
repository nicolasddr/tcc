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

import ProjectPromptPage from '@/app/projects/[id]/prompt/page'
import PromptVersionPage from '@/app/projects/[id]/prompt/[versionId]/page'
import { PromptHistory } from '@/app/projects/[id]/pipeline/prompt-history'
import { PromptMetadataList } from '@/app/projects/[id]/pipeline/prompt-metadata'
import {
  VersionBadges,
  VersionMeta,
} from '@/app/projects/[id]/pipeline/version-history'
import { PromptEditor } from '@/app/projects/[id]/pipeline/prompt-editor'
import { PromptMetadataEditor } from '@/app/projects/[id]/pipeline/prompt-metadata-editor'
import { PromptTest } from '@/app/projects/[id]/pipeline/prompt-test'
import { ProjectTabs } from '@/app/projects/[id]/project-tabs'
import type { PromptVersionSummary } from '@/app/projects/[id]/pipeline/prompt'
import { Button } from '@/app/components/ui/button'
import { formatDate } from '@/app/notifications/labels'
import { llmModel } from '@/lib/ai'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  addPromptVersion,
  addCodebookVersion,
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

function collectText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (isValidElement(node)) {
    return collectText((node.props as { children?: unknown }).children)
  }
  return ''
}

function textOf(node: unknown): string {
  return collectText(node).replace(/\s+/g, ' ').trim()
}

type HistoryProps = Parameters<typeof PromptHistory>[0]

function renderPrompt(id: string) {
  return ProjectPromptPage({ params: Promise.resolve({ id }) })
}

function renderVersion(id: string, versionId: string) {
  return PromptVersionPage({ params: Promise.resolve({ id, versionId }) })
}

function metadataTextOf(tree: unknown): string {
  const element = findElement(tree, PromptMetadataList)
  if (!element) return ''
  return textOf(PromptMetadataList(element.props as Parameters<typeof PromptMetadataList>[0]))
}

function historyOf(tree: unknown): HistoryProps {
  const element = findElement(tree, PromptHistory)
  expect(element).toBeTruthy()
  return element!.props as HistoryProps
}

function expectNoEditing(tree: unknown) {
  expect(findElement(tree, 'form')).toBeNull()
  expect(findElement(tree, 'button')).toBeNull()
  expect(findElement(tree, Button)).toBeNull()
  expect(findElement(tree, PromptEditor)).toBeNull()
  expect(findElement(tree, PromptMetadataEditor)).toBeNull()
}

describe('app/projects/[id]/prompt — a tela do prompt', () => {
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

  it('lista todas as versões, da mais recente para a mais antiga', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    for (const versionNumber of [1, 2, 3]) {
      await addPromptVersion(ownerDb, project, admin, {
        versionNumber,
        usedAt: versionNumber === 3 ? null : new Date().toISOString(),
      })
    }

    auth.userId = admin
    const props = historyOf(await renderPrompt(project))
    expect(props.versions.map((v) => v.versionNumber)).toEqual([3, 2, 1])
  })

  it('cada linha mostra número, data, autor e os metadados preenchidos', async () => {
    const admin = await newUser('Ana Pesquisadora')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, {
      name: 'instrução direta',
      description: 'pede a categoria e uma justificativa de uma linha',
      changeLog: 'primeira redação do prompt',
    })

    auth.userId = admin
    const props = historyOf(await renderPrompt(project))
    const [version] = props.versions
    expect(version.authorName).toBe('Ana Pesquisadora')

    expect(textOf(PromptHistory(props))).toContain('Versão 1')

    const metadataText = metadataTextOf(PromptHistory(props))
    expect(metadataText).toContain('instrução direta')
    expect(metadataText).toContain('pede a categoria e uma justificativa de uma linha')
    expect(metadataText).toContain('primeira redação do prompt')

    const metaText = textOf(VersionMeta({ version }))
    expect(metaText).toContain(formatDate(version.createdAt))
    expect(metaText).toContain('Ana Pesquisadora')
  })

  it('o metadado vazio não deixa rótulo órfão na linha nem na versão', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin, {
      name: 'só o nome',
    })

    auth.userId = admin
    const listText = metadataTextOf(PromptHistory(historyOf(await renderPrompt(project))))
    expect(listText).toContain('Nome')
    expect(listText).toContain('só o nome')
    expect(listText).not.toContain('Descrição')
    expect(listText).not.toContain('Registro de mudanças')

    const detailText = metadataTextOf(await renderVersion(project, versionId))
    expect(detailText).toContain('só o nome')
    expect(detailText).not.toContain('Descrição')
    expect(detailText).not.toContain('Registro de mudanças')
  })

  it('a versão sem nenhum metadado não mostra bloco de metadados', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin)

    auth.userId = admin
    expect(findElement(await renderVersion(project, versionId), PromptMetadataList)).toBeNull()
    expect(
      findElement(PromptHistory(historyOf(await renderPrompt(project))), PromptMetadataList),
    ).toBeNull()
  })

  it('fica claro qual é a vigente e se ela está em aberto ou já congelou', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 1,
      usedAt: new Date().toISOString(),
    })
    await addPromptVersion(ownerDb, project, admin, { versionNumber: 2 })

    auth.userId = admin
    const [current, old] = historyOf(await renderPrompt(project)).versions

    expect(current.isLatest).toBe(true)
    expect(current.isOpen).toBe(true)
    expect(textOf(VersionBadges({ version: current }))).toContain('vigente')
    expect(textOf(VersionBadges({ version: current }))).toContain('em aberto')

    expect(old.isLatest).toBe(false)
    expect(old.isOpen).toBe(false)
    expect(textOf(VersionBadges({ version: old }))).toContain('congelada')
    expect(textOf(VersionBadges({ version: old }))).not.toContain('vigente')
  })

  it('a versão vigente já usada aparece como congelada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { usedAt: new Date().toISOString() })

    auth.userId = admin
    const [version] = historyOf(await renderPrompt(project)).versions
    expect(version.isLatest).toBe(true)
    expect(version.isOpen).toBe(false)
    expect(textOf(VersionBadges({ version }))).toContain('congelada')
  })

  it('o projeto sem nenhuma versão mostra o histórico vazio', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const props = historyOf(await renderPrompt(project))
    expect(props.versions).toEqual([])
    expect(textOf(PromptHistory(props))).toContain('Nenhuma versão do prompt ainda')
  })

  it('abrir uma versão antiga mostra o texto daquela versão, com a formatação preservada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const oldId = await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 1,
      text: 'linha um\n\n  linha recuada',
      usedAt: new Date().toISOString(),
    })
    await addPromptVersion(ownerDb, project, admin, {
      versionNumber: 2,
      text: 'texto vigente',
    })

    auth.userId = admin
    const tree = await renderVersion(project, oldId)
    expect(collectText(tree)).toContain('linha um\n\n  linha recuada')
    expect(collectText(tree)).not.toContain('texto vigente')
  })

  it('a tela da versão diz o número e se ela está em aberto ou congelada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addPromptVersion(ownerDb, project, admin, { versionNumber: 1 })
    await addPromptVersion(ownerDb, project, admin, { versionNumber: 2 })

    auth.userId = admin
    const tree = await renderVersion(project, frozenId)
    expect(textOf(tree)).toContain('Versão 1 do prompt')

    const badges = findElement(tree, VersionBadges)
    expect(badges).toBeTruthy()

    const props = badges!.props as { version: PromptVersionSummary }
    expect(props.version.versionNumber).toBe(1)
    expect(textOf(VersionBadges(props))).toContain('congelada')
  })

  it('o histórico não oferece editar ou apagar nenhuma versão', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addPromptVersion(ownerDb, project, admin, {
      name: 'primeira versão',
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    const list = await renderPrompt(project)
    expectNoEditing(PromptHistory(historyOf(list)))

    expectNoEditing(await renderVersion(project, versionId))
  })

  it('a tela traz o editor, os dados da versão e o teste junto com o histórico', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })

    auth.userId = admin
    const tree = await renderPrompt(project)

    const editor = findElement(tree, PromptEditor)
    expect(editor).toBeTruthy()
    expect(
      (editor!.props as Parameters<typeof PromptEditor>[0]).version?.text,
    ).toBe('Classifique a consulta.')

    expect(findElement(tree, PromptMetadataEditor)).toBeTruthy()
    expect(findElement(tree, PromptTest)).toBeTruthy()
    expect(historyOf(tree).versions.map((v) => v.versionNumber)).toEqual([1])
  })

  it('o teste do prompt fica indisponível enquanto faltar definição, prompt ou item', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin, { name: 'Consulta 001' })

    auth.userId = admin
    const test = findElement(await renderPrompt(project), PromptTest)
    expect(test).toBeTruthy()
    expect((test!.props as Parameters<typeof PromptTest>[0]).ready).toBe(false)
  })

  it('com os três insumos, o teste libera e mostra o modelo e o pool de itens', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin)
    await addPromptVersion(ownerDb, project, admin, { text: 'Classifique a consulta.' })
    await addInputItem(ownerDb, project, admin, { name: 'Consulta 001' })

    auth.userId = admin
    const props = findElement(await renderPrompt(project), PromptTest)!
      .props as Parameters<typeof PromptTest>[0]
    expect(props.ready).toBe(true)
    expect(props.model).toBe(llmModel())
    expect(props.items.map((item) => item.name)).toEqual(['Consulta 001'])
  })

  it('a aba do prompt fica marcada como ativa', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const tabs = findElement(await renderPrompt(project), ProjectTabs)
    expect(tabs).toBeTruthy()
    expect((tabs!.props as Parameters<typeof ProjectTabs>[0]).active).toBe('prompt')
  })

  it('o Avaliador não acessa a tela nem a versão', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const versionId = await addPromptVersion(ownerDb, project, admin)

    auth.userId = evaluator
    await expect(renderPrompt(project)).rejects.toThrow('NEXT_NOTFOUND')
    await expect(renderVersion(project, versionId)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('quem não é membro não acessa, e a recusa não distingue projeto inexistente', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)

    auth.userId = outsider
    const existing = await renderPrompt(project).catch((e: Error) => e.message)
    const missing = await renderPrompt(crypto.randomUUID()).catch((e: Error) => e.message)
    expect(existing).toBe('NEXT_NOTFOUND')
    expect(missing).toBe(existing)
  })

  it('o membro com onboarding pendente é levado ao fluxo de entrada', async () => {
    const admin = await newUser('Admin')
    const pending = await newUser('Em Onboarding')
    const project = await newProject(admin)
    await addPendingMember(ownerDb, project, pending)

    auth.userId = pending
    await expect(renderPrompt(project)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${project}/onboarding`,
    )
  })

  it('a versão de outro projeto não abre pela rota deste', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const other = await newProject(admin)
    const otherVersion = await addPromptVersion(ownerDb, other, admin)

    auth.userId = admin
    await expect(renderVersion(project, otherVersion)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('versão inexistente ou identificador inválido não derruba a página', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    await expect(renderVersion(project, crypto.randomUUID())).rejects.toThrow(
      'NEXT_NOTFOUND',
    )
    await expect(renderVersion(project, 'não-é-uuid')).rejects.toThrow('NEXT_NOTFOUND')
  })
})
