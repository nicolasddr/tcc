import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

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

import ProjectCodebookPage from '@/app/projects/[id]/(tabs)/codebook/page'
import CodebookVersionPage from '@/app/projects/[id]/(tabs)/codebook/[versionId]/page'
import { CodebookHistory } from '@/app/projects/[id]/pipeline/codebook-history'
import type { CodebookVersionSummary } from '@/app/projects/[id]/pipeline/codebook'
import {
  VersionBadges,
  VersionCounts,
  VersionMeta,
} from '@/app/projects/[id]/pipeline/version-history'
import { DefinitionList } from '@/app/projects/[id]/pipeline/definition-list'
import {
  CodebookEditor,
  CodebookReadOnly,
} from '@/app/projects/[id]/pipeline/codebook-editor'
import { VersionStatus } from '@/app/projects/[id]/pipeline/version-status'
import { Button } from '@/app/components/ui/button'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { formatDate } from '@/app/notifications/labels'
import { PHASE_1, PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  addCodebookVersion,
  addPromptVersion,
  addRound,
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

  it('a tela abre em leitura, sem nenhum campo, e oferece editar as definições', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        {
          title: 'Informacional',
          type: 'category',
          description: 'busca informação',
          criteria: [{ name: 'Cita a fonte' }],
        },
      ],
      generalCriteria: [{ name: 'Clareza' }],
    })

    auth.userId = admin
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    expect(editor).toBeTruthy()

    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    const html = renderToStaticMarkup(createElement(CodebookEditor, props))

    expect(html).not.toContain('<input')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('<select')
    expect(html).toContain('Editar defini')
    expect(html).toContain('Informacional')
    expect(html).toContain('busca informa')
    expect(html).toContain('Clareza')
  })

  it('com rodada aberta, a tela fica em leitura e explica que é preciso fechar a rodada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
      ],
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
    })

    auth.userId = admin
    const tree = await renderCodebook(project)

    const editor = findElement(tree, CodebookEditor)
    expect(editor).toBeTruthy()

    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    expect(props.openRoundNumber).toBe(1)

    const readOnly = CodebookReadOnly({
      version: props.version,
      isOpen: props.isOpen,
      openRoundNumber: props.openRoundNumber ?? null,
      definitions: props.definitions,
      criteria: props.criteria,
      inPhase2: true,
    })
    expect(findElement(readOnly, 'form')).toBeNull()
    expect(textOf(readOnly)).toContain('rodada 1')
    expect(textOf(readOnly)).toContain('Feche a rodada')
  })

  it('com a rodada fechada, a versão congelada volta a ser editável na tela', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
      ],
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
      status: 'closed',
    })

    auth.userId = admin
    const tree = await renderCodebook(project)

    const editor = findElement(tree, CodebookEditor)
    expect(editor).toBeTruthy()

    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    expect(props.openRoundNumber).toBeNull()
    expect(props.isOpen).toBe(false)

    const status = VersionStatus({ version: props.version, isOpen: props.isOpen })
    expect(textOf(status)).toContain('congelada')

    const tooltip = findElement(status, InfoTooltip)
    expect(tooltip).toBeTruthy()
    expect((tooltip!.props as { text: string }).text).toContain('cria a versão 2')
  })

  it('sem rodada aberta, o editor não recebe trava nenhuma', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)

    auth.userId = admin
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    expect(props.openRoundNumber).toBeNull()
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
  it('o editor recebe os critérios da versão vigente, específicos e gerais', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        {
          title: 'Informacional',
          type: 'category',
          criteria: [{ name: 'Cita a fonte' }],
        },
        { title: 'Transacional', type: 'category' },
      ],
      generalCriteria: [{ name: 'Clareza' }],
    })

    auth.userId = admin
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    expect(editor).toBeTruthy()

    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    expect(props.criteria.map((c) => c.name).sort()).toEqual(['Cita a fonte', 'Clareza'])
    expect(props.criteria.filter((c) => c.definitionId === null)).toHaveLength(1)
  })

  it('a versão em leitura traz o critério geral dentro de cada definição', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        {
          title: 'Informacional',
          type: 'category',
          criteria: [{ name: 'Cita a fonte', description: 'a fonte é verificável' }],
        },
        { title: 'Transacional', type: 'category' },
      ],
      generalCriteria: [{ name: 'Clareza' }],
    })

    auth.userId = admin
    const props = definitionsOf(await renderVersion(project, versionId))
    expect(props.criteria?.map((c) => c.name).sort()).toEqual([
      'Cita a fonte',
      'Clareza',
    ])

    const text = textOf(DefinitionList(props))
    expect(text).toContain('Cita a fonte')
    expect(text).toContain('a fonte é verificável')
    expect(text.match(/Clareza/g)).toHaveLength(2)
    expect(text).toContain('geral')
  })

  it('cada linha do histórico traz a contagem de definições e de critérios', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        {
          title: 'Informacional',
          type: 'category',
          criteria: [{ name: 'Cita a fonte' }],
        },
        { title: 'Transacional', type: 'category' },
      ],
      generalCriteria: [{ name: 'Clareza' }, { name: 'Objetividade' }],
    })

    auth.userId = admin
    const props = historyOf(await renderCodebook(project))
    expect(props.versions[0].definitionCount).toBe(2)
    expect(props.versions[0].criterionCount).toBe(3)

    const text = textOf(VersionCounts({ version: props.versions[0] }))
    expect(text).toContain('2 definições')
    expect(text).toContain('3 critérios')
  })

  it('a versão sem critério nenhum aparece no histórico com a contagem zerada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [{ title: 'Informacional', type: 'category' }],
    })

    auth.userId = admin
    const props = historyOf(await renderCodebook(project))
    expect(props.versions[0].criterionCount).toBe(0)
    expect(textOf(VersionCounts({ version: props.versions[0] }))).toBe(
      '1 definição · 0 critérios',
    )
  })
})
