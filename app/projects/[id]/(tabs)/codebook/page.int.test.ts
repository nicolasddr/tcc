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
  CodebookFields,
  ORDER_HELP,
  changesLabel,
} from '@/app/projects/[id]/pipeline/codebook-editor'
import { VersionStatus } from '@/app/projects/[id]/pipeline/version-status'
import { Button, buttonClass } from '@/app/components/ui/button'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { Section } from '@/app/components/ui/section'
import { formatDate } from '@/app/notifications/labels'
import {
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
} from '@/app/projects/[id]/pipeline/preconditions'
import { FROZEN_RETURN_LINK, frozenLead } from '@/app/projects/[id]/pipeline/freeze'
import { codebookLockedMessage } from '@/app/projects/[id]/(tabs)/rounds/preconditions'
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

function sectionTitles(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(sectionTitles)
  if (!isValidElement(node)) return []
  const props = node.props as Record<string, unknown>
  const own = node.type === Section ? [String(props.title)] : []
  return [...own, ...Object.values(props).flatMap(sectionTitles)]
}

function sectionHelp(node: unknown, title: string): string {
  if (Array.isArray(node)) return node.map((child) => sectionHelp(child, title)).join('')
  if (!isValidElement(node)) return ''
  const props = node.props as Record<string, unknown>
  if (node.type === Section && props.title === title) return String(props.help)
  return Object.values(props)
    .map((value) => sectionHelp(value, title))
    .join('')
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
    expect(textOf(VersionBadges({ version: current }))).toContain('Vigente')
    expect(textOf(VersionBadges({ version: current }))).toContain('Em aberto')

    expect(old.isLatest).toBe(false)
    expect(old.isOpen).toBe(false)
    expect(textOf(VersionBadges({ version: old }))).toContain('Congelada')
    expect(textOf(VersionBadges({ version: old }))).not.toContain('Vigente')
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
    expect(textOf(VersionBadges({ version }))).toContain('Congelada')
  })

  it('sem nenhuma versão, a tela não tem histórico; ele aparece a partir da versão 1', async () => {
    const admin = await newUser('Admin')
    const empty = await newProject(admin)
    const versioned = await newProject(admin)
    await addCodebookVersion(ownerDb, versioned, admin)

    auth.userId = admin
    const emptyTree = await renderCodebook(empty)
    expect(findElement(emptyTree, CodebookHistory)).toBeNull()
    expect(sectionTitles(emptyTree)).toEqual(['Definições'])

    const versionedTree = await renderCodebook(versioned)
    expect(sectionTitles(versionedTree)).toEqual(['Definições', 'Histórico de versões'])
    expect(historyOf(versionedTree).versions.map((v) => v.versionNumber)).toEqual([1])
  })

  it('o codebook vazio na Fase 1 diz o próximo passo e oferece adicionar definições', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_1)

    auth.userId = admin
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    const html = renderToStaticMarkup(createElement(CodebookEditor, props))

    expect(html).toContain('Nenhuma definição ainda.')
    expect(html).toContain(
      'Na Fase 1 bastam título e tipo; a descrição e os critérios entram na Fase 2.',
    )
    expect(html).toContain('Adicionar definições')
    expect(html).not.toContain('Editar definições')
    expect(html).not.toContain('>Editar</button>')
    expect(html).not.toContain('Esta versão não tem definições.')
    expect(html.match(/cria a versão 1/g)).toHaveLength(1)
  })

  it('a versão que existe e está vazia continua dizendo que não tem definições', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const versionId = await addCodebookVersion(ownerDb, project, admin, { definitions: [] })

    auth.userId = admin
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    const html = renderToStaticMarkup(createElement(CodebookEditor, props))
    expect(html).toContain('Esta versão não tem definições.')
    expect(html).not.toContain('Nenhuma definição ainda.')
    expect(html).toContain('>Editar</button>')

    expect(textOf(await renderVersion(project, versionId))).toContain(
      'Esta versão não tem definições.',
    )
  })

  it('o ⓘ das definições não repete a frase visível', async () => {
    const admin = await newUser('Admin')
    const phase1 = await newProject(admin, PHASE_1)
    const phase2 = await newProject(admin, PHASE_2)
    await addCodebookVersion(ownerDb, phase2, admin)

    auth.userId = admin
    for (const project of [phase1, phase2]) {
      const help = sectionHelp(await renderCodebook(project), 'Definições')
      expect(help).not.toContain('Os conceitos que estruturam a tarefa da LLM')
    }
    expect(sectionHelp(await renderCodebook(phase1), 'Definições')).toContain(
      'A descrição e os critérios de cada definição são escritos na Fase 2.',
    )
    expect(sectionHelp(await renderCodebook(phase2), 'Definições')).toContain(
      'Só os títulos vão para a LLM.',
    )
  })

  it('os ⓘ do editor do codebook ficam em até 25 palavras', async () => {
    expect(ORDER_HELP.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(25)
    expect(ORDER_HELP).toContain('aparecem para a equipe e vão à LLM')
    expect(ORDER_HELP).toContain('Reordene pelas setas')
    expect(ORDER_HELP).toContain('a ordem é salva com a versão')

    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addCodebookVersion(ownerDb, project, admin)

    auth.userId = admin
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    const html = renderToStaticMarkup(createElement(CodebookEditor, props))
    const tooltips = [...html.matchAll(/<span [^>]*role="tooltip"[^>]*>([^<]*)<\/span>/g)].map(
      (match) => match[1],
    )
    expect(tooltips.length).toBeGreaterThan(0)
    for (const text of tooltips) {
      expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(25)
    }
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
    expect(textOf(VersionBadges(props))).toContain('Congelada')
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
    expect(html).toContain('Informacional')
    expect(html).toContain('busca informa')
    expect(html).toContain('Clareza')
  })

  it('em leitura, o "Editar" fica na linha da versão, acima das definições, e não no pé', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [{ title: 'Informacional', type: 'category' }],
    })

    auth.userId = admin
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    const html = renderToStaticMarkup(createElement(CodebookEditor, props))

    expect(html).not.toContain('Editar definições')
    const edits = [...html.matchAll(/<button[^>]*>Editar<\/button>/g)]
    expect(edits).toHaveLength(1)
    expect(edits[0][0]).toContain(`class="${buttonClass('secondary', { size: 'sm' })}"`)

    const version = html.indexOf('Versão 1')
    const status = html.indexOf('Em aberto')
    const edit = edits[0].index!
    const legend = html.indexOf('O que é cada tipo')
    expect(status).toBeGreaterThan(version)
    expect(edit).toBeGreaterThan(status)
    expect(legend).toBeGreaterThan(edit)
  })

  it('em edição, só a barra de salvar fecha o formulário, e o cartão não repete o título "Definições"', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [{ title: 'Informacional', type: 'category' }],
    })

    auth.userId = admin
    const tree = await renderCodebook(project)
    const props = findElement(tree, CodebookEditor)!.props as Parameters<
      typeof CodebookEditor
    >[0]
    const html = renderToStaticMarkup(
      createElement(CodebookFields, {
        definitions: props.definitions,
        criteria: props.criteria,
        defaultType: props.defaultType,
        note: props.version?.note ?? '',
        inPhase2: true,
        pending: false,
        status: null,
        onDone: () => {},
      }),
    )

    expect(html).not.toContain('Voltar à leitura')
    expect(html).not.toContain('Salvar definições')
    expect(html).toContain('Nenhuma alteração.')
    expect(html).toContain('>Cancelar</button>')
    expect(html).not.toContain('>Descartar</button>')
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>Salvar<\/button>/)

    expect(sectionTitles(tree).filter((title) => title === 'Definições')).toHaveLength(1)
    expect(html).not.toMatch(/<h\d[^>]*>\s*Definições/)

    const tooltips = [...html.matchAll(/<span [^>]*role="tooltip"[^>]*>([^<]*)<\/span>/g)].map(
      (match) => match[1],
    )
    expect(tooltips).toContain(ORDER_HELP)
  })

  it('em edição, a definição fechada mostra "Editar" e a aberta mostra "Recolher"', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [{ title: 'Informacional', type: 'category' }],
    })

    auth.userId = admin
    const props = findElement(await renderCodebook(project), CodebookEditor)!.props as Parameters<
      typeof CodebookEditor
    >[0]
    const fields = (definitions: typeof props.definitions) =>
      renderToStaticMarkup(
        createElement(CodebookFields, {
          definitions,
          criteria: props.criteria,
          defaultType: props.defaultType,
          note: '',
          inPhase2: true,
          pending: false,
          status: null,
          onDone: () => {},
        }),
      )

    const closed = fields(props.definitions)
    expect(closed).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Editar<\/button>/)
    expect(closed).not.toContain('Recolher')
    expect(closed).not.toContain('Concluir edição')

    const opened = fields([])
    expect(opened).toMatch(/<button[^>]*aria-expanded="true"[^>]*>Recolher<\/button>/)
    expect(opened).not.toContain('Concluir edição')
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

    const html = renderToStaticMarkup(createElement(CodebookEditor, props))
    expect(html).not.toContain('<form')
    expect(html).toContain(codebookLockedMessage(1))
    const notice = noticeTagOf(html, codebookLockedMessage(1))
    expect(notice).toContain('bg-surface-subtle')
    expect(notice).not.toContain('warning')
  })

  function noticeTagOf(html: string, text: string): string {
    const notice = html.match(new RegExp(`<p [^>]*>(?:(?!<p ).)*?${text.slice(0, 20)}`))
    expect(notice).toBeTruthy()
    return notice![0]
  }

  async function editorHtml(project: string): Promise<string> {
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    expect(editor).toBeTruthy()
    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    return renderToStaticMarkup(createElement(CodebookEditor, props))
  }

  it('na Fase 4, a tela fica em leitura, mostra as definições e explica o congelamento', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_4)
    await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        {
          title: 'Informacional',
          type: 'category',
          description: 'busca informação',
          criteria: [{ name: 'Cita a fonte' }],
        },
      ],
    })

    auth.userId = admin
    const html = await editorHtml(project)

    expect(html).not.toContain('<form')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('Editar defini')
    expect(html).not.toContain('>Editar</button>')
    expect(html).toContain('Informacional')
    expect(html).toContain('busca informa')
    expect(html).toContain('Cita a fonte')
    expect(html).toContain(frozenLead('codebook'))
    expect(html).toContain(`href="/projects/${project}#voltar"`)
    expect(html).toContain(`>${FROZEN_RETURN_LINK}</a>`)
    expect(noticeTagOf(html, frozenLead('codebook'))).toContain('bg-surface-subtle')
  })

  it('na Fase 4 com rodada aberta, o aviso é o do congelamento, e não o de fechar a rodada', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_4)
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
      ],
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin, {
      usedAt: new Date().toISOString(),
    })
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 2,
      phase: PHASE_4,
    })

    auth.userId = admin
    const html = await editorHtml(project)

    expect(html).not.toContain('<form')
    expect(html).toContain(frozenLead('codebook'))
    expect(html).toContain(`href="/projects/${project}#voltar"`)
    expect(html).toContain(`>${FROZEN_RETURN_LINK}</a>`)
    expect(noticeTagOf(html, frozenLead('codebook'))).toContain('bg-surface-subtle')
    expect(html).not.toContain('Feche a rodada')
  })

  it.each([PHASE_2, PHASE_3])(
    'na Fase %i sem rodada aberta, a tela continua oferecendo editar as definições',
    async (phase) => {
      const admin = await newUser('Admin')
      const project = await newProject(admin, phase)
      await addCodebookVersion(ownerDb, project, admin, {
        definitions: [{ title: 'Informacional', type: 'category' }],
      })

      auth.userId = admin
      const html = await editorHtml(project)

      expect(html).toContain('>Editar</button>')
      expect(html).not.toContain('Fase 4')
    },
  )

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
    expect(textOf(status)).toContain('Congelada')

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
    expect(text).toContain('Geral')
  })

  async function perResponseScene(usedAt?: string) {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    const versionId = await addCodebookVersion(ownerDb, project, admin, {
      usedAt,
      definitions: [
        { title: 'Informacional', type: 'category' },
        { title: 'Transacional', type: 'category' },
      ],
      generalCriteria: [{ name: 'Clareza' }],
      perResponseCriteria: [
        { name: 'Diversity', description: 'as consultas cobrem temas distintos' },
      ],
    })
    auth.userId = admin
    return { project, versionId }
  }

  async function readingMarkup(project: string): Promise<string> {
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    expect(editor).toBeTruthy()
    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    return renderToStaticMarkup(createElement(CodebookEditor, props))
  }

  it('em leitura, o critério por resposta vem num bloco próprio depois da última definição', async () => {
    const { project } = await perResponseScene()
    const html = await readingMarkup(project)

    const title = html.indexOf('>Critérios por resposta<')
    expect(title).toBeGreaterThan(html.lastIndexOf('Transacional'))
    expect(html.match(/Diversity/g)).toHaveLength(1)
    expect(html.match(/as consultas cobrem temas distintos/g)).toHaveLength(1)
    expect(html.indexOf('Diversity')).toBeGreaterThan(title)
    expect(html.indexOf('as consultas cobrem temas distintos')).toBeGreaterThan(title)
    expect(html).toContain('Julgam a resposta inteira: uma nota por resposta, sem definição.')
    expect(html.match(/>Geral</g)).toHaveLength(2)
  })

  it('a versão congelada mostra o bloco do critério por resposta', async () => {
    const { project, versionId } = await perResponseScene(new Date().toISOString())

    const text = textOf(DefinitionList(definitionsOf(await renderVersion(project, versionId))))
    expect(text).toContain('Critérios por resposta')
    expect(text.match(/Diversity/g)).toHaveLength(1)
    expect(text).toContain('as consultas cobrem temas distintos')
    expect(text.indexOf('Diversity')).toBeGreaterThan(text.indexOf('Critérios por resposta'))
  })

  it('o card "Critérios" conta o critério por resposta à parte, e não como próprio', async () => {
    const { project } = await perResponseScene()
    const html = await readingMarkup(project)

    expect(html).toContain('>0 próprios · 1 geral · 1 por resposta<')
    expect(html).toMatch(/Notas por resposta[\s\S]*?text-\[26px\][^>]*>3</)
    expect(html).toContain('>2 definições × 1 critério geral + 1 por resposta<')
  })

  it('sem critério por resposta, a leitura não ganha bloco nem termo no card "Critérios"', async () => {
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
    const html = await readingMarkup(project)
    expect(html).not.toContain('Critérios por resposta')
    expect(html).toContain('>1 próprio · 1 geral<')

    const text = textOf(DefinitionList(definitionsOf(await renderVersion(project, versionId))))
    expect(text).not.toContain('Critérios por resposta')
  })

  async function editingMarkup(project: string, inPhase2 = true): Promise<string> {
    const editor = findElement(await renderCodebook(project), CodebookEditor)
    expect(editor).toBeTruthy()
    const props = editor!.props as Parameters<typeof CodebookEditor>[0]
    return renderToStaticMarkup(
      createElement(CodebookFields, {
        definitions: props.definitions,
        criteria: props.criteria,
        defaultType: props.defaultType,
        note: props.version?.note ?? '',
        inPhase2,
        pending: false,
        status: null,
        onDone: () => {},
      }),
    )
  }

  it('em edição, o critério por resposta tem bloco próprio entre os gerais e a observação', async () => {
    const { project } = await perResponseScene()
    const html = await editingMarkup(project)

    const general = html.indexOf('>Critérios gerais<')
    const title = html.indexOf('>Critérios por resposta<')
    expect(general).toBeGreaterThan(-1)
    expect(title).toBeGreaterThan(general)
    expect(html.indexOf('Observação desta versão')).toBeGreaterThan(title)

    expect(html.indexOf('value="Diversity"')).toBeGreaterThan(title)
    expect(html.match(/name="criterion_scope" value="per_response"/g)).toHaveLength(1)
    expect(html.match(/Diversity/g)).toHaveLength(1)
    expect(html.match(/Herdados dos critérios gerais · 1/g)).toHaveLength(2)

    const help = html
      .slice(title)
      .match(/<span [^>]*role="tooltip"[^>]*>([^<]*)<\/span>/)?.[1]
    expect(help).toBe(
      'Valem para a resposta inteira, e não para uma definição: cada um rende uma nota só por resposta.',
    )
    expect(help!.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(25)
  })

  it('em edição, o card "Notas por resposta" conta o critério por resposta, como na leitura', async () => {
    const { project } = await perResponseScene()
    const html = await editingMarkup(project)

    expect(html).toMatch(/Notas por resposta[\s\S]*?text-\[26px\][^>]*>3</)
    expect(html).toContain('>2 definições × 1 critério geral + 1 por resposta<')
  })

  it('em edição, o bloco por resposta aparece vazio sem critério, e não aparece antes da Fase 2', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin, PHASE_2)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [{ title: 'Informacional', type: 'category' }],
      generalCriteria: [{ name: 'Clareza' }],
    })

    auth.userId = admin
    const html = await editingMarkup(project)
    expect(html.indexOf('Nenhum critério por resposta nesta versão.')).toBeGreaterThan(
      html.indexOf('>Critérios por resposta<'),
    )
    expect(html).toContain('>Adicionar critério por resposta</button>')
    expect(html).not.toContain('name="criterion_scope" value="per_response"')

    const early = await editingMarkup(project, false)
    expect(early).not.toContain('Critérios por resposta')
    expect(early).not.toContain('critério por resposta')
  })

  it('a barra de salvar diz quando os critérios por resposta mudaram, depois dos gerais', () => {
    expect(changesLabel(0, false, true, false)).toBe(
      'Alterações não salvas: critérios por resposta alterados.',
    )
    expect(changesLabel(2, true, true, true)).toBe(
      'Alterações não salvas: 2 definições alteradas · critérios gerais alterados · critérios por resposta alterados · observação alterada.',
    )
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
