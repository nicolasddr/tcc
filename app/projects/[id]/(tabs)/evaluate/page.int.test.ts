import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Fragment, createElement, isValidElement, type ReactElement } from 'react'
import { eq } from 'drizzle-orm'
import { renderToStaticMarkup } from 'react-dom/server'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOTFOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import ProjectEvaluatePage from '@/app/projects/[id]/(tabs)/evaluate/page'
import { EvaluationForm } from '@/app/projects/[id]/(tabs)/evaluate/evaluation-form'
import { ScaleOptions } from '@/app/projects/[id]/(tabs)/evaluate/scale-options'
import { ItemPanel, PromptPanel } from '@/app/projects/[id]/(tabs)/evaluate/context-panel'
import { formatDate } from '@/app/notifications/labels'
import { QueueNav } from '@/app/components/ui/queue-nav'
import {
  AgreementPanel,
  AgreementValue,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-panel'
import { buildQueue } from '@/app/projects/[id]/(tabs)/evaluate/queue'
import { PROGRESS_HELP } from '@/app/projects/[id]/(tabs)/evaluate/progress'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { listRoundResponses } from '@/app/projects/[id]/pipeline/responses'
import {
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
} from '@/app/projects/[id]/pipeline/preconditions'
import { QualityPanel, QualityValue } from '@/app/projects/[id]/(tabs)/rounds/quality-panel'
import { roundInputSummary } from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { Section } from '@/app/components/ui/section'
import { ProgressBar } from '@/app/components/ui/stat'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { ownerDb, rounds } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  addEvaluation,
  memberId as memberIdOf,
  cleanup,
  type CriterionFixture,
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

type FormProps = Parameters<typeof EvaluationForm>[0]

type PanelProps = Parameters<typeof PromptPanel>[0]

type ItemProps = Parameters<typeof ItemPanel>[0]

function render(id: string, response?: string, sent?: boolean) {
  return ProjectEvaluatePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({
      ...(response ? { response } : {}),
      ...(sent ? { sent: '1' } : {}),
    }),
  })
}

type NavProps = Parameters<typeof QueueNav>[0]

function navPropsOf(tree: unknown): NavProps {
  const nav = findElement(tree, QueueNav)
  expect(nav).toBeTruthy()
  return nav!.props as NavProps
}

function navOf(tree: unknown): { prev: string | null; next: string | null } {
  const { prev, next } = navPropsOf(tree)
  return { prev, next }
}

type SectionProps = Parameters<typeof Section>[0]

function sectionOf(tree: unknown): SectionProps {
  const section = findElement(tree, Section)
  expect(section).toBeTruthy()
  return section!.props as SectionProps
}

function headingOf(tree: unknown): string {
  return collectText(sectionOf(tree).title).replace(/\s+/g, ' ').trim()
}

function panelOf(tree: unknown): PanelProps {
  const element = findElement(tree, PromptPanel)
  expect(element).toBeTruthy()
  return element!.props as PanelProps
}

function panelMarkupOf(tree: unknown): string {
  return renderToStaticMarkup(createElement(PromptPanel, panelOf(tree)))
}

function itemMarkupOf(tree: unknown): string {
  const element = findElement(tree, ItemPanel)
  expect(element).toBeTruthy()
  return renderToStaticMarkup(createElement(ItemPanel, element!.props as ItemProps))
}

async function open(id: string, response?: string) {
  if (response) return render(id, response)

  const chosen = await render(id).then(
    () => null,
    (error: Error) => /NEXT_REDIRECT:.*[?]response=(.+)$/.exec(error.message)?.[1] ?? null,
  )
  expect(chosen).toBeTruthy()
  return render(id, chosen!)
}

function screenTextOf(tree: unknown): string {
  return [
    deepText(tree),
    renderToStaticMarkup(createElement(Fragment, null, tree as ReactElement)),
    markupOf(formOf(tree)),
    panelMarkupOf(tree),
    itemMarkupOf(tree),
  ]
    .join(' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
    .replace(/\s+/g, ' ')
    .trim()
}

function formOf(tree: unknown): FormProps {
  const element = findElement(tree, EvaluationForm)
  expect(element).toBeTruthy()
  return element!.props as FormProps
}

function markupOf(props: FormProps): string {
  return renderToStaticMarkup(createElement(EvaluationForm, props))
}

type Scene = {
  project: string
  round: string
  codebookVersion: string
  responses: string[]
}

describe('app/projects/[id]/evaluate — a tela do avaliador', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function scenario(
    admin: string,
    opts: {
      definitions?: {
        title: string
        description?: string
        criteria?: CriterionFixture[]
      }[]
      generalCriteria?: CriterionFixture[]
      perResponseCriteria?: CriterionFixture[]
      responses?: number
      phase?: number
      openRound?: boolean
      prompt?: { text?: string; name?: string; description?: string }
      item?: { name?: string; content?: string }
      responseText?: string
      sentInput?: string
    } = {},
  ): Promise<Scene> {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: opts.phase ?? PHASE_2,
    })
    projs.push(project)

    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      definitions: (
        opts.definitions ?? [{ title: 'Informacional', criteria: [{ name: 'Clareza' }] }]
      ).map((definition) => ({
        title: definition.title,
        type: 'category',
        description: definition.description ?? null,
        criteria: definition.criteria ?? [],
      })),
      generalCriteria: opts.generalCriteria,
      perResponseCriteria: opts.perResponseCriteria,
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin, {
      text: opts.prompt?.text,
      name: opts.prompt?.name ?? null,
      description: opts.prompt?.description ?? null,
    })

    if (opts.openRound === false) {
      return { project, round: '', codebookVersion, responses: [] }
    }

    const round = await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      phase: opts.phase ?? PHASE_2,
    })

    const responses: string[] = []
    for (let index = 0; index < (opts.responses ?? 1); index += 1) {
      const first = index === 0
      const item = await addInputItem(ownerDb, project, admin, {
        name: (first ? opts.item?.name : undefined) ?? `Item ${index + 1}`,
        content: first ? opts.item?.content : undefined,
      })
      responses.push(
        await addResponse(ownerDb, round, item, admin, {
          text: (first ? opts.responseText : undefined) ?? `Resposta ${index + 1}`,
          sentInput: first ? opts.sentInput : undefined,
        }),
      )
    }

    return { project, round, codebookVersion, responses }
  }

  async function newEvaluator(project: string, name = 'Avaliadora'): Promise<string> {
    const user = await newUser(name)
    await addActiveEvaluator(ownerDb, project, user)
    return user
  }

  /** A fila que AQUELE vínculo deve ver, calculada fora da página. */
  async function queueOf(scene: Scene, evaluator: string): Promise<string[]> {
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    const listed = await listRoundResponses(scene.round)
    return buildQueue(listed, [], member, scene.round).map((response) => response.id)
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o avaliador ativo vê o formulário, com os critérios gerais dentro de cada definição', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        { title: 'Informacional', criteria: [{ name: 'Cita a fonte' }] },
        { title: 'Transacional', criteria: [{ name: 'Aciona' }] },
      ],
      generalCriteria: [{ name: 'Clareza' }],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)
    const props = formOf(tree)

    expect(props.response.id).toBe(scene.responses[0])
    expect(props.response.text).toBe('Resposta 1')
    expect(props.submitted).toBeNull()
    expect(headingOf(tree)).toContain('Avaliar na rodada 1')

    expect(
      props.cells.map((cell) => `${cell.definition?.title}/${cell.criterion.name}`),
    ).toEqual([
      'Informacional/Cita a fonte',
      'Informacional/Clareza',
      'Transacional/Aciona',
      'Transacional/Clareza',
    ])

    const html = markupOf(props)
    expect(html).toContain('Enviar avalia')
    expect(html).toContain('Alto')
    expect(html).toContain('Médio')
    expect(html).toContain('Baixo')
    expect(html).toContain('+ Justificar')
  })

  it('a justificativa começa fechada, atrás de um "+ Justificar" por critério', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [{ title: 'Informacional', criteria: [{ name: 'Cita a fonte' }] }],
      generalCriteria: [{ name: 'Clareza' }],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const html = markupOf(formOf(await open(scene.project)))

    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('name="justification_')
    expect(html.match(/>\+ Justificar</g)).toHaveLength(2)
    expect(html).toMatch(/aria-label="Justificar Cita a fonte" aria-expanded="false"/)
    expect(html).toMatch(/aria-label="Justificar Clareza" aria-expanded="false"/)
  })

  it('os botões de nota têm a altura de 40 px', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const html = markupOf(formOf(await open(scene.project)))
    const buttons = html.match(/<button[^>]*aria-pressed[^>]*>/g) ?? []

    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button).toContain('py-[9px]')
      expect(button).toContain('text-sm')
    }
  })

  it('os botões de nota mostram o marcador da escala, sem cor de semáforo', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const html = markupOf(formOf(await open(scene.project)))
    const buttons = html.match(/<button[^>]*aria-pressed[^>]*>[\s\S]*?<\/button>/g) ?? []

    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button).toContain('aria-hidden="true"')
      expect(button).toContain('bg-quality-high')
      expect(button).not.toMatch(/(?:bg|text)-(?:success|warning|danger)/)
    }
  })

  describe('a descrição do nível', () => {
    async function described() {
      const admin = await newUser('Admin')
      const scene = await scenario(admin, {
        definitions: [
          {
            title: 'Informacional',
            criteria: [
              {
                name: 'Relevância',
                levels: { high: 'mantém a intenção', low: 'muda de assunto' },
              },
            ],
          },
        ],
      })
      const evaluator = await newEvaluator(scene.project)

      auth.userId = evaluator
      return formOf(await open(scene.project))
    }

    function buttonsOf(html: string): Record<string, string> {
      const buttons: Record<string, string> = {}
      for (const button of html.match(/<button[^>]*aria-pressed[^>]*>[\s\S]*?<\/button>/g) ?? []) {
        const label = /(Alto|Médio|Baixo)<\/button>$/.exec(button)
        if (label) buttons[label[1]] = button
      }
      return buttons
    }

    function tooltipOf(html: string, id: string): string | null {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return (
        new RegExp(`<span[^>]*id="${escaped}"[^>]*>([\\s\\S]*?)</span>`).exec(html)?.[0] ??
        null
      )
    }

    it('os botões dos níveis descritos apontam para o balão com a descrição, e o vazio não aponta', async () => {
      const props = await described()
      const html = markupOf(props)
      const buttons = buttonsOf(html)

      expect(Object.keys(buttons)).toEqual(['Alto', 'Médio', 'Baixo'])
      expect(buttons['Médio']).not.toContain('aria-describedby')

      for (const [label, text] of [
        ['Alto', 'mantém a intenção'],
        ['Baixo', 'muda de assunto'],
      ]) {
        const id = /aria-describedby="([^"]+)"/.exec(buttons[label])?.[1]
        expect(id).toBeTruthy()
        const tooltip = tooltipOf(html, id!)
        expect(tooltip).toContain('role="tooltip"')
        expect(tooltip).toContain(`>${text}</span>`)
        expect(tooltip).toMatch(/class="[^"]*\bhidden\b/)
        expect(buttons[label]).not.toContain(text)
      }
    })

    it('o nível escolhido mostra a sua descrição abaixo dos botões, e sem escolha nada aparece', async () => {
      const props = await described()
      const criterion = props.cells[0].criterion
      expect(criterion.levels).toEqual({
        high: 'mantém a intenção',
        medium: null,
        low: 'muda de assunto',
      })

      const markup = (value: string) =>
        renderToStaticMarkup(
          createElement(ScaleOptions, {
            criterion,
            value,
            disabled: false,
            onChange: () => {},
          }),
        )

      expect(markupOf(props)).not.toContain('Alto: ')
      expect(markup('')).not.toContain('Alto: ')
      expect(markup('')).not.toContain('Baixo: ')

      const high = markup('high')
      expect(high).toMatch(/<p class="[^"]*text-xs text-muted[^"]*">Alto: mantém a intenção<\/p>/)
      expect(high.indexOf('Alto: mantém')).toBeGreaterThan(high.lastIndexOf('</button>'))
      expect(high).not.toContain('Baixo: ')

      expect(markup('low')).toContain('>Baixo: muda de assunto</p>')
      expect(markup('medium')).not.toContain('Médio: ')
      expect(markup('medium')).not.toMatch(/<p[^>]*>Médio/)
    })

    it('o balão fica preso à esquerda do grupo de botões, não do botão', async () => {
      const props = await described()
      const html = markupOf(props)
      const group = /<div class="([^"]*)"><div role="group" aria-label="Nota de Relevância"/.exec(html)

      expect(group).toBeTruthy()
      expect(group![1]).toContain('relative')
      for (const tooltip of html.match(/<span[^>]*role="tooltip"[^>]*>/g) ?? []) {
        expect(tooltip).toContain('left-0')
        expect(tooltip).toContain('top-full')
      }
      expect(html.match(/role="tooltip"/g)).toHaveLength(2)
    })
  })

  it('a barra de envio fica presa ao rodapé, com o contador, o botão e o aviso nessa ordem', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        { title: 'Informacional', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', criteria: [{ name: 'Aciona' }, { name: 'Cita' }] },
      ],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const html = markupOf(formOf(await open(scene.project)))
    const bar = /<div class="((?:[^"]* )?sticky [^"]*)"[^>]*>([\s\S]*)$/.exec(html)

    expect(bar).toBeTruthy()
    expect(bar![1]).toContain('bottom-0')
    const counter = bar![2].indexOf('0 de 3 notas')
    const submit = bar![2].indexOf('Enviar avaliação')
    const warning = bar![2].indexOf('O envio é definitivo.')
    expect(counter).toBeGreaterThanOrEqual(0)
    expect(submit).toBeGreaterThan(counter)
    expect(warning).toBeGreaterThan(submit)
  })

  it('a descrição da definição e a do critério ficam visíveis abaixo do nome, sem ⓘ e sem o selo geral', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        {
          title: 'Informacional',
          description: 'busca informação',
          criteria: [{ name: 'Cita a fonte', description: 'menciona de onde veio' }],
        },
      ],
      generalCriteria: [{ name: 'Clareza', description: 'linha um\nlinha dois' }],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const props = formOf(await open(scene.project))

    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    const codebook = await loadCodebookVersion(scene.project, scene.codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member, {
      cells: cells.map((cell) => ({
        definitionId: cell.definition?.id ?? null,
        criterionId: cell.criterion.id,
        value: 'high' as const,
      })),
    })
    const reading = formOf(await open(scene.project))
    expect(reading.submitted).not.toBeNull()

    for (const html of [markupOf(props), markupOf(reading)]) {
      expect(html).toContain('>busca informação</')
      expect(html).toContain('>menciona de onde veio</')
      expect(html).toContain('>linha um\nlinha dois</')
      expect(html).not.toContain('aria-label="busca informação"')
      expect(html).not.toContain('aria-label="menciona de onde veio"')
      expect(html).not.toContain('aria-label="linha um')
      expect(html).not.toContain('>Geral<')
    }
  })

  it('o envio definitivo é dito uma vez, ao lado do botão, e o aviso do total vai para o ⓘ', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 2 })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)
    const section = findElement(tree, Section)!.props as { hint?: unknown; help?: string }

    expect(section.hint).toBeUndefined()
    expect(section.help).toBeUndefined()
    expect(textOf(tree)).toContain('0 de 2 respostas avaliadas por você nesta rodada')
    expect(textOf(tree)).not.toContain('pode crescer')
    expect(findElement(tree, InfoTooltip)?.props).toEqual({ text: PROGRESS_HELP })

    const html = markupOf(formOf(tree))
    const [before, after] = html.split('Enviar avaliação')

    expect(html).toContain('Dê uma nota em cada critério. Justificativa é opcional.')
    expect(html.match(/definitivo/g)).toHaveLength(1)
    expect(before).not.toContain('definitivo')
    expect(after).toContain('O envio é definitivo.')
  })

  it('sem nota em toda célula, o envio fica travado e a barra conta as notas que faltam', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [
        { title: 'Informacional', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', criteria: [{ name: 'Aciona' }] },
      ],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const html = markupOf(formOf(await open(scene.project)))

    expect(html).toContain('disabled=""')
    expect(html).toContain('0 de 2 notas')
    expect(html).not.toContain('ainda t')
  })

  it('a resposta já avaliada aparece em leitura, sem campo e sem editar nem apagar', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [{ title: 'Informacional', criteria: [{ name: 'Clareza' }] }],
    })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)

    const codebook = await loadCodebookVersion(scene.project, scene.codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member, {
      cells: cells.map((cell) => ({
        definitionId: cell.definition?.id ?? null,
        criterionId: cell.criterion.id,
        value: 'medium' as const,
        justification: 'porque sim',
      })),
    })

    auth.userId = evaluator
    const props = formOf(await open(scene.project))
    expect(props.submitted).not.toBeNull()

    const html = markupOf(props)
    expect(html).toContain('Médio')
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>(?:<span [^>]*><\/span>){3}<\/span>Médio</)
    expect(html).not.toMatch(/(?:bg|text)-(?:success|warning|danger)/)
    expect(html).toContain('porque sim')
    expect(html).not.toContain('definitivo')
    expect(html).not.toContain('Enviada em')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('Enviar avalia')
    expect(html).not.toContain('Editar')
    expect(html).not.toContain('Apagar')
    expect(html).not.toContain('Excluir')
  })

  it('o critério por resposta vira o grupo "Por resposta", depois das definições, com o campo dele', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [{ title: 'Informacional' }, { title: 'Transacional' }],
      generalCriteria: [{ name: 'Clareza' }],
      perResponseCriteria: [{ name: 'Diversity', description: 'varia as fontes' }],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const props = formOf(await open(scene.project))
    const diversity = props.cells.find((cell) => cell.criterion.name === 'Diversity')!
    const html = markupOf(props)

    expect(html).toContain('0 de 3 notas')
    expect(html).toContain('>Por resposta</')
    expect(html.indexOf('>Por resposta</')).toBeGreaterThan(html.indexOf('>Transacional</'))
    expect(html.indexOf('>Por resposta</')).toBeLessThan(html.indexOf('Enviar avaliação'))

    const group = html.slice(html.indexOf('>Por resposta</'), html.indexOf('Enviar avaliação'))
    expect(group).toContain('>Diversity</')
    expect(group).toContain('>varia as fontes</')
    expect(group).toContain(`name="score_per_response_${diversity.criterion.id}"`)
    expect(group).not.toContain('>Geral<')
  })

  it('em leitura, o grupo "Por resposta" mostra a nota e a justificativa do critério por resposta', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      definitions: [{ title: 'Informacional' }, { title: 'Transacional' }],
      generalCriteria: [{ name: 'Clareza' }],
      perResponseCriteria: [{ name: 'Diversity', description: 'varia as fontes' }],
    })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)

    const codebook = await loadCodebookVersion(scene.project, scene.codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member, {
      cells: cells.map((cell) => ({
        definitionId: cell.definition?.id ?? null,
        criterionId: cell.criterion.id,
        value: cell.definition ? ('high' as const) : ('low' as const),
        justification: cell.definition ? null : 'repete a mesma fonte',
      })),
    })

    auth.userId = evaluator
    const props = formOf(await open(scene.project))
    expect(props.submitted).not.toBeNull()

    const html = markupOf(props)
    expect(html).toContain('>Por resposta</')
    expect(html.indexOf('>Por resposta</')).toBeGreaterThan(html.indexOf('>Transacional</'))

    const group = html.slice(html.indexOf('>Por resposta</'))
    expect(group).toContain('>Diversity</')
    expect(group).toContain('>varia as fontes</')
    expect(group).toContain('Baixo')
    expect(group).not.toContain('Alto')
    expect(group).toContain('repete a mesma fonte')
  })

  it('sem ?response= na rota, a página redireciona para a primeira DA MINHA fila', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 6 })
    const evaluator = await newEvaluator(scene.project)
    const [first] = await queueOf(scene, evaluator)

    auth.userId = evaluator
    await expect(render(scene.project)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${scene.project}/evaluate?response=${first}`,
    )
  })

  it('dois avaliadores do mesmo projeto abrem em ordens diferentes', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 8 })
    const mine = await newEvaluator(scene.project, 'Avaliadora')
    const theirs = await newEvaluator(scene.project, 'Avaliador')

    const myQueue = await queueOf(scene, mine)
    const theirQueue = await queueOf(scene, theirs)
    expect(theirQueue).not.toEqual(myQueue)

    auth.userId = mine
    expect(formOf(await open(scene.project)).response.id).toBe(myQueue[0])

    auth.userId = theirs
    expect(formOf(await open(scene.project)).response.id).toBe(theirQueue[0])
  })

  it('o rótulo vem da ordem canônica e é o mesmo para os dois avaliadores', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 4 })
    const mine = await newEvaluator(scene.project, 'Avaliadora')
    const theirs = await newEvaluator(scene.project, 'Avaliador')

    const third = scene.responses[2]

    auth.userId = mine
    expect(formOf(await open(scene.project, third)).label).toBe('Resposta 3')

    auth.userId = theirs
    expect(formOf(await open(scene.project, third)).label).toBe('Resposta 3')
  })

  it('voltar pelo controle a uma resposta já enviada mostra o modo leitura', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 3 })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    const queue = await queueOf(scene, evaluator)
    await addEvaluation(ownerDb, scene.round, queue[0], member)

    auth.userId = evaluator
    const back = navOf(await render(scene.project, queue[1])).prev
    expect(back).toBe(`/projects/${scene.project}/evaluate?response=${queue[0]}`)

    const props = formOf(await render(scene.project, queue[0]))
    expect(props.response.id).toBe(queue[0])
    expect(props.submitted).not.toBeNull()

    const html = markupOf(props)
    expect(html).toContain('Sem justificativa.')
    expect(html).not.toContain('definitivo')
    expect(html).not.toContain('<textarea')
  })

  it('anterior e próxima apontam para os vizinhos na MINHA ordem', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 5 })
    const evaluator = await newEvaluator(scene.project)
    const queue = await queueOf(scene, evaluator)
    const route = `/projects/${scene.project}/evaluate?response=`

    auth.userId = evaluator
    expect(navOf(await render(scene.project, queue[2]))).toEqual({
      prev: `${route}${queue[1]}`,
      next: `${route}${queue[3]}`,
    })
  })

  it('nas pontas da fila, o controle que falta não aponta para lugar nenhum', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 4 })
    const evaluator = await newEvaluator(scene.project)
    const queue = await queueOf(scene, evaluator)
    const route = `/projects/${scene.project}/evaluate?response=`

    auth.userId = evaluator
    expect(navOf(await render(scene.project, queue[0]))).toEqual({
      prev: null,
      next: `${route}${queue[1]}`,
    })
    expect(navOf(await render(scene.project, queue[3]))).toEqual({
      prev: `${route}${queue[2]}`,
      next: null,
    })
  })

  it('o controle diz em que posição da MINHA fila estou', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 5 })
    const evaluator = await newEvaluator(scene.project)
    const queue = await queueOf(scene, evaluator)

    auth.userId = evaluator
    expect(navPropsOf(await render(scene.project, queue[0])).position).toEqual({
      current: 1,
      total: 5,
    })
    expect(navPropsOf(await render(scene.project, queue[3])).position).toEqual({
      current: 4,
      total: 5,
    })

    const nav = navPropsOf(await render(scene.project, queue[2]))
    expect(renderToStaticMarkup(createElement(QueueNav, nav))).toMatch(/>3 de 5</)
  })

  it('com uma resposta só, nenhum controle leva a lugar nenhum', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    expect(navOf(await open(scene.project))).toEqual({ prev: null, next: null })
  })

  it('a confirmação do envio vem de ?sent=1, e o redirect canônico não a carrega', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 2 })
    const evaluator = await newEvaluator(scene.project)
    const queue = await queueOf(scene, evaluator)

    auth.userId = evaluator
    expect(textOf(await render(scene.project, queue[1], true))).toContain(
      'Avaliação enviada',
    )
    expect(textOf(await render(scene.project, queue[1]))).not.toContain(
      'Avaliação enviada',
    )

    await expect(render(scene.project, undefined, true)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${scene.project}/evaluate?response=${queue[0]}`,
    )
    const url = await render(scene.project, undefined, true).then(
      () => '',
      (error: Error) => error.message,
    )
    expect(url).not.toContain('sent')
  })

  it('o painel do prompt fica aberto, fora de <details>, com o rótulo "Prompt · versão N" quando sem nome', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      prompt: { text: 'Classifique a intenção de busca.' },
      item: { name: 'como plantar manjericão', content: 'Consulta do usuário.' },
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)
    const html = panelMarkupOf(tree)

    expect(html).toContain('Prompt · versão 1')
    expect(html).not.toContain('<details')
    expect(html).not.toContain('Ver o prompt')
    expect(html).toContain('Classifique a inten')
    expect(html).not.toContain('O que foi pedido')
    expect(html).not.toContain('como plantar manjeric')
    expect(html).not.toContain('Consulta do usu')
    expect(html).not.toContain('Item de entrada')
  })

  it('o item de entrada fica aberto, fora de <details>, com o rótulo "Item de entrada · nome"', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      item: { name: 'como plantar manjericão', content: 'Linha um\nLinha dois' },
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)
    const html = itemMarkupOf(tree)

    expect(html).toContain('Item de entrada · como plantar manjericão')
    expect(html).not.toContain('<details')
    expect(html).toMatch(
      /class="[^"]*max-h-\[40vh\][^"]*whitespace-pre-wrap[^"]*"[^>]*>Linha um\nLinha dois</,
    )
    expect(markupOf(formOf(tree)).split('como plantar manjericão').length - 1).toBe(1)
  })

  it('o nome do prompt vai no rótulo no lugar da versão, e a descrição aparece só quando preenchida', async () => {
    const admin = await newUser('Admin')
    const named = await scenario(admin, {
      prompt: { name: 'Classificador v1', description: 'Sem exemplos ainda.' },
    })
    const bare = await scenario(admin)
    const evaluator = await newEvaluator(named.project)
    await addActiveEvaluator(ownerDb, bare.project, evaluator)

    auth.userId = evaluator
    const withMetadata = panelMarkupOf(await open(named.project))
    expect(withMetadata).toContain('Prompt · Classificador v1')
    expect(withMetadata).not.toContain('versão')
    expect(withMetadata).toContain('Sem exemplos ainda')

    const without = panelMarkupOf(await open(bare.project))
    expect(without).toContain('Prompt · versão 1')
    expect(without).not.toContain('text-muted')
  })

  it('o painel fica FORA do formulário, para o preenchido não se perder ao abri-lo', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)

    expect(findElement(formOf(tree).prompt, PromptPanel)).toBeTruthy()
    expect(findElement(formOf(tree).item, ItemPanel)).toBeTruthy()

    const html = markupOf(formOf(tree))
    const form = html.slice(html.indexOf('<form'), html.indexOf('</form>'))
    expect(html).toContain('Prompt · ')
    expect(html).toContain('Item de entrada')
    expect(form).toContain('Enviar avalia')
    expect(form).not.toContain('Prompt · ')
    expect(form).not.toContain('Item de entrada')
  })

  it('a coluna da esquerda empilha prompt, item e resposta, na mesma ordem em toda largura', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const html = markupOf(formOf(await open(scene.project)))

    const prompt = html.indexOf('Prompt · ')
    const item = html.indexOf('Item de entrada')
    const response = html.indexOf('Resposta da LLM')
    const form = html.indexOf('<form')
    expect(prompt).toBeGreaterThan(-1)
    expect(prompt).toBeLessThan(item)
    expect(item).toBeLessThan(response)
    expect(response).toBeLessThan(form)
    expect(html).not.toContain('order-first')
  })

  it('o prompt, o item e a resposta usam o mesmo cartão, e a resposta não mostra data', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)
    const props = formOf(tree)

    expect(findElement(props.prompt, PromptPanel)).toBeTruthy()
    expect(findElement(props.item, ItemPanel)).toBeTruthy()
    const html = markupOf(props)
    const left = html.slice(0, html.indexOf('<form'))
    const cardClass = /<div class="([^"]*)"><div class="flex flex-col gap-0.5"><span[^>]*>(Prompt|Item de entrada|Resposta da LLM) · /g
    const classes = [...left.matchAll(cardClass)].map((match) => match[1])
    expect(classes).toHaveLength(3)
    expect(new Set(classes).size).toBe(1)
    expect(classes[0]).toContain('rounded-card')
    expect(html).not.toContain(formatDate(props.response.createdAt))
  })

  it('a barra de envio é um cartão arredondado com respiro nas laterais', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const html = markupOf(formOf(await open(scene.project)))
    const bar = /<div class="([^"]*\bsticky bottom-0[^"]*)">/.exec(html)?.[1] ?? ''

    expect(bar).toContain('rounded-card')
    expect(bar).toContain('border ')
    expect(bar).toMatch(/px-\[14px\]/)
  })

  it('o texto da resposta e o do prompt preservam a formatação', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      prompt: { text: 'Linha 1\nLinha 2' },
      responseText: 'Parágrafo 1\n\nParágrafo 2',
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)

    expect(markupOf(formOf(tree))).toMatch(
      /class="[^"]*whitespace-pre-wrap[^"]*"[^>]*>Parágrafo 1/,
    )
    expect(panelMarkupOf(tree)).toMatch(/class="[^"]*whitespace-pre-wrap[^"]*"[^>]*>Linha 1/)
  })

  it('o título da rodada não tem ⓘ', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project, 'Marta Ribeiro')

    auth.userId = evaluator
    const tree = await open(scene.project)
    expect(headingOf(tree)).toBe('Avaliar na rodada 1')
    expect(sectionOf(tree).help).toBeUndefined()
    expect(textOf(tree)).not.toContain('Avaliando como')
  })

  it('anterior e próxima ficam na linha do título', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 2 })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)

    expect(findElement(sectionOf(tree).action, QueueNav)).toBeTruthy()
    expect(findElement(sectionOf(tree).children, QueueNav)).toBeNull()
  })

  it('o rótulo "Resposta N" aparece uma vez, no cabeçalho da resposta, também no modo leitura', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responseText: 'Texto da LLM.' })
    const evaluator = await newEvaluator(scene.project)

    function occurrences(tree: unknown): number {
      return renderToStaticMarkup(createElement(Fragment, null, tree as ReactElement)).split(
        'Resposta 1',
      ).length - 1
    }

    auth.userId = evaluator
    const pending = await open(scene.project)
    expect(textOf(pending)).not.toContain('Resposta 1')
    expect(markupOf(formOf(pending))).toContain('Resposta da LLM · Resposta 1')
    expect(markupOf(formOf(pending))).toContain('Texto da LLM.')
    expect(occurrences(pending)).toBe(1)

    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member)

    const reading = await open(scene.project, scene.responses[0])
    expect(formOf(reading).submitted).not.toBeNull()
    expect(textOf(reading)).not.toContain('Resposta 1')
    expect(markupOf(formOf(reading))).toContain('Resposta da LLM · Resposta 1')
    expect(markupOf(formOf(reading))).toContain('Texto da LLM.')
    expect(occurrences(reading)).toBe(1)
  })

  it('a rota escolhe a resposta pedida, e sem pedido abre a primeira ainda não avaliada', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 2 })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member)

    auth.userId = evaluator
    expect(formOf(await open(scene.project)).response.id).toBe(scene.responses[1])
    expect(formOf(await open(scene.project, scene.responses[0])).response.id).toBe(
      scene.responses[0],
    )
  })

  it('nenhuma tela do avaliador exibe coeficiente', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await open(scene.project)
    const page = `${textOf(tree)} ${markupOf(formOf(tree))}`.toLowerCase()

    expect(page).not.toContain('coeficiente')
    expect(page).not.toContain('kappa')
    expect(page).not.toContain('concord')
  })

  it('com a rodada já medida por dois avaliadores, o avaliador segue sem ver o ICR', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 2 })
    const ana = await newEvaluator(scene.project, 'Ana')
    const bruno = await newEvaluator(scene.project, 'Bruno')

    const codebook = await loadCodebookVersion(scene.project, scene.codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria).map((cell) => ({
      definitionId: cell.definition?.id ?? null,
      criterionId: cell.criterion.id,
      value: 'high' as const,
    }))

    for (const user of [ana, bruno]) {
      const member = await memberIdOf(ownerDb, scene.project, user)
      await addEvaluation(ownerDb, scene.round, scene.responses[0], member, { cells })
    }

    auth.userId = bruno
    const tree = await open(scene.project)

    expect(findElement(tree, AgreementPanel)).toBeNull()
    expect(findElement(tree, AgreementValue)).toBeNull()

    const page = `${deepText(tree)} ${markupOf(formOf(tree))}`
    expect(page).not.toContain('Krippendorff')
    expect(page).not.toContain('ICR')
    expect(page).not.toContain('Concordância')
  })

  it('a tela de avaliação é igual nas Fases 2, 3 e 4', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliadora')
    const scenes = [
      await scenario(admin, { phase: PHASE_2 }),
      await scenario(admin, { phase: PHASE_3 }),
      await scenario(admin, { phase: PHASE_4 }),
    ]

    auth.userId = evaluator
    const texts: string[] = []
    for (const scene of scenes) {
      await addActiveEvaluator(ownerDb, scene.project, evaluator)
      texts.push(screenTextOf(await open(scene.project)))
    }

    expect(texts[0]).toContain('Resposta 1')
    expect(texts[1]).toBe(texts[0])
    expect(texts[2]).toBe(texts[0])
  })

  it.each([PHASE_3, PHASE_4])('na Fase %i, a tela de avaliação não diz a fase, nem o que a LLM recebeu, nem a Qualidade', async (phase) => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { phase, responses: 2 })
    const ana = await newEvaluator(scene.project, 'Ana')
    await addActiveEvaluator(ownerDb, scene.project, admin)

    const codebook = await loadCodebookVersion(scene.project, scene.codebookVersion)
    const cells = resolveCells(codebook!.definitions, codebook!.criteria).map((cell) => ({
      definitionId: cell.definition?.id ?? null,
      criterionId: cell.criterion.id,
      value: 'high' as const,
    }))
    const member = await memberIdOf(ownerDb, scene.project, ana)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member, { cells })

    for (const user of [ana, admin]) {
      auth.userId = user
      const tree = await open(scene.project)
      const page = screenTextOf(tree)

      expect(page).toContain('Resposta')
      for (const word of ['Fase', 'codebook completo', 'Qualidade', '%']) {
        expect(page).not.toContain(word)
      }
      expect(page).not.toContain(roundInputSummary(PHASE_2))
      expect(page).not.toContain(roundInputSummary(PHASE_3))
      expect(page).not.toContain(roundInputSummary(PHASE_4))
      expect(findElement(tree, QualityPanel)).toBeNull()
      expect(findElement(tree, QualityValue)).toBeNull()
    }
  })

  it('sem codebook nenhum, a tela diz que o administrador ainda está montando', async () => {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: PHASE_2,
    })
    projs.push(project)
    const evaluator = await newEvaluator(project)

    auth.userId = evaluator
    const tree = await render(project)
    expect(findElement(tree, EvaluationForm)).toBeNull()
    expect(textOf(tree)).toContain('montando o codebook')
  })

  it('com definição sem critério, a espera ainda é o codebook', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      openRound: false,
      definitions: [{ title: 'Informacional', criteria: [] }],
    })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    expect(textOf(await render(scene.project))).toContain('montando o codebook')
  })

  it('antes da Fase 2, a espera é o codebook mesmo com o codebook pronto', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { openRound: false, phase: PHASE_1 })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    expect(textOf(await render(scene.project))).toContain('montando o codebook')
  })

  it('com o codebook pronto e sem rodada aberta, a tela espera a rodada', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { openRound: false })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await render(scene.project)
    expect(findElement(tree, EvaluationForm)).toBeNull()
    expect(textOf(tree)).toContain('abrir uma rodada')
  })

  it('fechada a rodada, a espera oferece a revisão da última rodada que eu avaliei', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 1 })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    await addEvaluation(ownerDb, scene.round, scene.responses[0], member)

    auth.userId = evaluator
    expect(
      hasProp(
        await render(scene.project, scene.responses[0]),
        'href',
        `/projects/${scene.project}/rounds/${scene.round}`,
      ),
    ).toBe(false)

    await ownerDb
      .update(rounds)
      .set({ status: 'closed', closedAt: new Date().toISOString() })
      .where(eq(rounds.id, scene.round))

    const tree = await render(scene.project)
    expect(textOf(tree)).toContain('abrir uma rodada')
    expect(textOf(tree)).toContain('revisão de discordâncias')
    expect(
      hasProp(tree, 'href', `/projects/${scene.project}/rounds/${scene.round}`),
    ).toBe(true)
  })

  it('a espera de quem não avaliou nada não oferece revisão nenhuma', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { openRound: false })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    expect(textOf(await render(scene.project))).not.toContain(
      'revisão de discordâncias',
    )
  })

  it('com rodada aberta e nenhuma resposta gerada, a tela espera as respostas', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 0 })
    const evaluator = await newEvaluator(scene.project)

    auth.userId = evaluator
    const tree = await render(scene.project)
    expect(findElement(tree, EvaluationForm)).toBeNull()
    expect(textOf(tree)).toContain('ainda não tem resposta gerada')
  })

  it('com tudo avaliado, a última resposta continua à mostra, sem aviso de que terminei', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 2 })
    const evaluator = await newEvaluator(scene.project)
    const member = await memberIdOf(ownerDb, scene.project, evaluator)
    for (const response of scene.responses) {
      await addEvaluation(ownerDb, scene.round, response, member)
    }

    auth.userId = evaluator
    const tree = await open(scene.project, scene.responses[1])
    const text = textOf(tree)

    expect(formOf(tree).response.id).toBe(scene.responses[1])
    expect(formOf(tree).submitted).not.toBeNull()
    expect(text).toContain('2 de 2 respostas avaliadas')
    expect(deepText(tree)).not.toContain('Você terminou')
    expect(deepText(tree)).not.toContain('aguarda o fechamento')
    expect(markupOf(formOf(tree))).not.toContain('Você terminou')
  })

  it('a barra de progresso conta só as MINHAS avaliações', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, { responses: 4 })
    const mine = await newEvaluator(scene.project, 'Avaliadora')
    const theirs = await newEvaluator(scene.project, 'Avaliador')
    const myMember = await memberIdOf(ownerDb, scene.project, mine)
    const theirMember = await memberIdOf(ownerDb, scene.project, theirs)

    await addEvaluation(ownerDb, scene.round, scene.responses[0], myMember)
    for (const response of scene.responses.slice(0, 3)) {
      await addEvaluation(ownerDb, scene.round, response, theirMember)
    }

    auth.userId = mine
    const tree = await open(scene.project)
    const bar = findElement(tree, ProgressBar)

    expect(bar).toBeTruthy()
    expect(bar!.props).toMatchObject({ value: 1, max: 4 })
    expect(textOf(tree)).toContain('1 de 4 respostas avaliadas')
  })

  it('o administrador sem vínculo de avaliador não alcança a tela', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)

    auth.userId = admin
    await expect(render(scene.project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o administrador-avaliador alcança a tela pelo vínculo de avaliador', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    await addActiveEvaluator(ownerDb, scene.project, admin)

    auth.userId = admin
    expect(formOf(await open(scene.project)).response.id).toBe(scene.responses[0])
  })

  it('a tela de avaliação não recebe a entrada enviada, nem quando quem avalia é o Administrador', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin, {
      sentInput: 'Entrada gravada da resposta.\nDefinições:\n  - Informacional',
    })
    const evaluator = await newEvaluator(scene.project)
    await addActiveEvaluator(ownerDb, scene.project, admin)

    for (const user of [evaluator, admin]) {
      auth.userId = user
      const tree = await open(scene.project)
      const markup = [
        renderToStaticMarkup(createElement(Fragment, null, tree)),
        markupOf(formOf(tree)),
        panelMarkupOf(tree),
      ].join(' ')

      expect(formOf(tree).response.id).toBe(scene.responses[0])
      expect(Object.keys(formOf(tree).response)).not.toContain('sentInput')
      expect(markup).toContain('Resposta 1')
      expect(markup).not.toContain('Entrada gravada da resposta')
      expect(deepText(tree)).not.toContain('Entrada gravada da resposta')
    }
  })

  it('quem não é membro não alcança a tela', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const stranger = await newUser('Estranho')

    auth.userId = stranger
    await expect(render(scene.project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o avaliador em onboarding é mandado concluir o onboarding', async () => {
    const admin = await newUser('Admin')
    const scene = await scenario(admin)
    const invited = await newUser('Convidado')
    await addPendingMember(ownerDb, scene.project, invited)

    auth.userId = invited
    await expect(render(scene.project)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${scene.project}/onboarding`,
    )
  })
})
