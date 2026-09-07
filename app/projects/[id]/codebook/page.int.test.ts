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

import ProjectCodebookPage from '@/app/projects/[id]/codebook/page'
import CodebookVersionPage from '@/app/projects/[id]/codebook/[versionId]/page'
import { CodebookHistory } from '@/app/projects/[id]/pipeline/codebook-history'
import type { CodebookVersionSummary } from '@/app/projects/[id]/pipeline/codebook'
import {
  VersionBadges,
  VersionMeta,
} from '@/app/projects/[id]/pipeline/version-history'
import { DefinitionList } from '@/app/projects/[id]/pipeline/definition-list'
import { CodebookEditor } from '@/app/projects/[id]/pipeline/codebook-editor'
import { ProjectTabs } from '@/app/projects/[id]/project-tabs'
import { Button } from '@/app/components/ui/button'
import { formatDate } from '@/app/notifications/labels'
import { PHASE_1, PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  addCodebookVersion,
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

type HistoryProps = Parameters<typeof CodebookHistory>[0]
type DefinitionListProps = Parameters<typeof DefinitionList>[0]

function renderCodebook(id: string) {
  return ProjectCodebookPage({ params: Promise.resolve({ id }) })
}

function renderVersion(id: string, versionId: string) {
  return CodebookVersionPage({ params: Promise.resolve({ id, versionId }) })
}

function historyOf(tree: unknown): HistoryProps {
  const element = findElement(tree, CodebookHistory)
  expect(element).toBeTruthy()
  return element!.props as HistoryProps
}

function definitionsOf(tree: unknown): DefinitionListProps {
  const element = findElement(tree, DefinitionList)
  expect(element).toBeTruthy()
  return element!.props as DefinitionListProps
}

function expectNoEditing(tree: unknown) {
  expect(findElement(tree, 'form')).toBeNull()
  expect(findElement(tree, 'button')).toBeNull()
  expect(findElement(tree, Button)).toBeNull()
  expect(findElement(tree, CodebookEditor)).toBeNull()
}

describe('app/projects/[id]/codebook — a tela do codebook', () => {
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

  it('lista todas as versões, da mais recente para a mais antiga', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    for (const versionNumber of [1, 2, 3]) {
      await addCodebookVersion(ownerDb, project, admin, {
        versionNumber,
        usedAt: versionNumber === 3 ? null : new Date().toISOString(),
      })
    }

    auth.userId = admin
    const props = historyOf(await renderCodebook(project))
    expect(props.versions.map((v) => v.versionNumber)).toEqual([3, 2, 1])
  })

  it('cada linha mostra número, data, autor e a observação, quando houver', async () => {
    const admin = await newUser('Ana Pesquisadora')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      note: 'separei “Transacional” de “Navegacional”',
    })

    auth.userId = admin
    const props = historyOf(await renderCodebook(project))
    const [version] = props.versions
    expect(version.authorName).toBe('Ana Pesquisadora')

    const listText = textOf(CodebookHistory(props))
    expect(listText).toContain('Versão 1')
    expect(listText).toContain('separei “Transacional” de “Navegacional”')

    const metaText = textOf(VersionMeta({ version }))
    expect(metaText).toContain(formatDate(version.createdAt))
    expect(metaText).toContain('Ana Pesquisadora')
  })

  it('a observação vazia não deixa rótulo órfão na linha', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, { note: null })

    auth.userId = admin
    const props = historyOf(await renderCodebook(project))
    expect(props.versions[0].note).toBeNull()
    expect(textOf(CodebookHistory(props))).toContain('Versão 1')
  })

  it('fica claro qual é a vigente e se ela está em aberto ou já congelou', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 1,
      usedAt: new Date().toISOString(),
    })
    await addCodebookVersion(ownerDb, project, admin, { versionNumber: 2 })

    auth.userId = admin
    const [current, old] = historyOf(await renderCodebook(project)).versions

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
    await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    const [version] = historyOf(await renderCodebook(project)).versions
    expect(version.isLatest).toBe(true)
    expect(version.isOpen).toBe(false)
    expect(textOf(VersionBadges({ version }))).toContain('congelada')
  })

  it('o projeto sem nenhuma versão mostra o histórico vazio', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const props = historyOf(await renderCodebook(project))
    expect(props.versions).toEqual([])
    expect(textOf(CodebookHistory(props))).toContain('Nenhuma versão do codebook ainda')
  })

  it('abrir uma versão antiga mostra as definições na ordem daquela versão', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const oldId = await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 1,
      usedAt: new Date().toISOString(),
      definitions: [
        { title: 'Informacional', type: 'category' },
        { title: 'Transacional', type: 'category' },
      ],
    })
    await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 2,
      definitions: [
        { title: 'Transacional', type: 'category' },
        { title: 'Informacional', type: 'category' },
        { title: 'Navegacional', type: 'category' },
      ],
    })

    auth.userId = admin
    const props = definitionsOf(await renderVersion(project, oldId))
    expect(props.definitions.map((d) => d.title)).toEqual([
      'Informacional',
      'Transacional',
    ])
    expect(props.definitions.map((d) => d.orderIndex)).toEqual([0, 1])
    expect(textOf(DefinitionList(props))).toContain('Informacional')
  })

  it('a tela da versão diz o número e se ela está em aberto ou congelada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const frozenId = await addCodebookVersion(ownerDb, project, admin, {
      versionNumber: 1,
      usedAt: new Date().toISOString(),
    })
    await addCodebookVersion(ownerDb, project, admin, { versionNumber: 2 })

    auth.userId = admin
    const tree = await renderVersion(project, frozenId)
    const badges = findElement(tree, VersionBadges)
    expect(badges).toBeTruthy()

    const props = badges!.props as { version: CodebookVersionSummary }
    expect(props.version.versionNumber).toBe(1)
    expect(textOf(VersionBadges(props))).toContain('congelada')
  })

  it('o histórico não oferece editar ou apagar nenhuma versão', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      note: 'primeira versão',
      usedAt: new Date().toISOString(),
    })

    auth.userId = admin
    const list = await renderCodebook(project)
    expectNoEditing(CodebookHistory(historyOf(list)))

    const detail = await renderVersion(project, versionId)
    expectNoEditing(detail)
    expectNoEditing(DefinitionList(definitionsOf(detail)))
  })

  it('a tela traz o editor das definições vigentes junto com o histórico', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category' },
        { title: 'Transacional', type: 'category' },
      ],
    })

    auth.userId = admin
    const tree = await renderCodebook(project)

    const editor = findElement(tree, CodebookEditor)
    expect(editor).toBeTruthy()

    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    expect(props.definitions.map((d) => d.title)).toEqual([
      'Informacional',
      'Transacional',
    ])
    expect(props.isOpen).toBe(true)
    expect(historyOf(tree).versions.map((v) => v.versionNumber)).toEqual([1])
  })

  it('a aba do codebook fica marcada como ativa', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    auth.userId = admin
    const tabs = findElement(await renderCodebook(project), ProjectTabs)
    expect(tabs).toBeTruthy()
    expect((tabs!.props as Parameters<typeof ProjectTabs>[0]).active).toBe('codebook')
  })

  it('o Avaliador não acessa a tela nem a versão', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const versionId = await addCodebookVersion(ownerDb, project, admin)

    auth.userId = evaluator
    await expect(renderCodebook(project)).rejects.toThrow('NEXT_NOTFOUND')
    await expect(renderVersion(project, versionId)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('quem não é membro não acessa, e a recusa não distingue projeto inexistente', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)

    auth.userId = outsider
    const existing = await renderCodebook(project).catch((e: Error) => e.message)
    const missing = await renderCodebook(crypto.randomUUID()).catch((e: Error) => e.message)
    expect(existing).toBe('NEXT_NOTFOUND')
    expect(missing).toBe(existing)
  })

  it('o membro com onboarding pendente é levado ao fluxo de entrada', async () => {
    const admin = await newUser('Admin')
    const pending = await newUser('Em Onboarding')
    const project = await newProject(admin)
    await addPendingMember(ownerDb, project, pending)

    auth.userId = pending
    await expect(renderCodebook(project)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${project}/onboarding`,
    )
  })

  it('a versão de outro projeto não abre pela rota deste', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const other = await newProject(admin)
    const otherVersion = await addCodebookVersion(ownerDb, other, admin)

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

  it('o editor recebe a fase do projeto, que é o que libera o campo de descrição', async () => {
    const admin = await newUser('Admin')
    const phase1 = await newProject(admin)
    const phase2 = await newProject(admin, PHASE_2)

    auth.userId = admin
    const editorOf = async (project: string) => {
      const editor = findElement(await renderCodebook(project), CodebookEditor)
      expect(editor).toBeTruthy()
      return editor!.props as Parameters<typeof CodebookEditor>[0]
    }

    expect((await editorOf(phase1)).phase).toBe(PHASE_1)
    expect((await editorOf(phase2)).phase).toBe(PHASE_2)
  })

  it('a versão em leitura traz a descrição de cada definição', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        { title: 'Informacional', type: 'category', description: 'busca informação' },
        { title: 'Transacional', type: 'category' },
      ],
    })

    auth.userId = admin
    const props = definitionsOf(await renderVersion(project, versionId))
    expect(props.definitions.map((d) => d.description)).toEqual([
      'busca informação',
      null,
    ])
    expect(textOf(DefinitionList(props))).toContain('busca informação')
  })
})
