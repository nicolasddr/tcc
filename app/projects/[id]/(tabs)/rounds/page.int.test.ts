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

import ProjectRoundsPage from '@/app/projects/[id]/(tabs)/rounds/page'
import { RoundList } from '@/app/projects/[id]/(tabs)/rounds/round-list'
import { NewRound } from '@/app/projects/[id]/(tabs)/rounds/new-round'
import { CloseRound } from '@/app/projects/[id]/(tabs)/rounds/close-round'
import { GenerateResponses } from '@/app/projects/[id]/(tabs)/rounds/generate-responses'
import { formatDate } from '@/app/notifications/labels'
import { PHASE_1, PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import {
  closeConfirmationLines,
  itemUsageLabel,
  roundBlockerMessage,
} from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { llmModel } from '@/lib/ai'
import { ownerDb } from '@/lib/db'
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

type ListProps = Parameters<typeof RoundList>[0]
type NewRoundProps = Parameters<typeof NewRound>[0]
type CloseRoundProps = Parameters<typeof CloseRound>[0]
type GenerateProps = Parameters<typeof GenerateResponses>[0]

function render(id: string) {
  return ProjectRoundsPage({ params: Promise.resolve({ id }) })
}

function listOf(tree: unknown): ListProps {
  const element = findElement(tree, RoundList)
  expect(element).toBeTruthy()
  return element!.props as ListProps
}

function newRoundOf(tree: unknown): NewRoundProps {
  const element = findElement(tree, NewRound)
  expect(element).toBeTruthy()
  return element!.props as NewRoundProps
}

function closeRoundOf(tree: unknown): CloseRoundProps {
  const element = findElement(tree, CloseRound)
  expect(element).toBeTruthy()
  return element!.props as CloseRoundProps
}

function generateOf(tree: unknown): GenerateProps {
  const element = findElement(tree, GenerateResponses)
  expect(element).toBeTruthy()
  return element!.props as GenerateProps
}

describe('app/projects/[id]/rounds — a área de rodadas do projeto', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function readyProject(
    admin: string,
    phase = PHASE_2,
  ): Promise<{ project: string; codebookVersion: string; promptVersion: string }> {
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase })
    projs.push(project)
    const codebookVersion = await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
      ],
    })
    const promptVersion = await addPromptVersion(ownerDb, project, admin)
    return { project, codebookVersion, promptVersion }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o projeto sem rodada mostra a lista vazia e o botão de nova rodada liberado', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin)

    auth.userId = admin
    const tree = await render(project)

    const list = listOf(tree)
    expect(list.rounds).toEqual([])
    expect(textOf(RoundList(list))).toContain('Nenhuma rodada ainda')

    const newRound = newRoundOf(tree)
    expect(newRound.blockers).toEqual([])
    expect(newRound.codebookVersionNumber).toBe(1)
    expect(newRound.promptVersionNumber).toBe(1)

    expect(findElement(tree, GenerateResponses)).toBeNull()
  })

  it('a lista mostra número, estado, versões usadas e data de cada rodada', async () => {
    const admin = await newUser('Ana Pesquisadora')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 1,
      status: 'closed',
    })
    await addRound(ownerDb, project, admin, codebookVersion, promptVersion, {
      roundNumber: 2,
    })

    auth.userId = admin
    const list = listOf(await render(project))
    expect(list.rounds.map((round) => round.roundNumber)).toEqual([1, 2])

    const text = textOf(RoundList(list))
    expect(text).toContain('Rodada 1')
    expect(text).toContain('fechada')
    expect(text).toContain('Rodada 2')
    expect(text).toContain('aberta')
    expect(text).toContain('Codebook v1 · Prompt v1')
    expect(text).toContain(formatDate(list.rounds[1].createdAt))
    expect(text).toContain('Ana Pesquisadora')
  })

  it('a tela diz qual definição está sem critério em vez de só desabilitar o botão', async () => {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: PHASE_2,
    })
    projs.push(project)
    await addCodebookVersion(ownerDb, project, admin, {
      definitions: [
        { title: 'Informacional', type: 'category', criteria: [{ name: 'Clareza' }] },
        { title: 'Transacional', type: 'category' },
      ],
    })
    await addPromptVersion(ownerDb, project, admin)

    auth.userId = admin
    const props = newRoundOf(await render(project))
    expect(props.blockers).toEqual([{ key: 'criteria', titles: ['Transacional'] }])
    expect(roundBlockerMessage(props.blockers[0])).toContain('“Transacional”')
  })

  it('na Fase 1 a tela explica que a rodada só começa na Fase 2', async () => {
    const admin = await newUser('Admin')
    const { project } = await readyProject(admin, PHASE_1)

    auth.userId = admin
    const props = newRoundOf(await render(project))
    const phaseBlocker = props.blockers.find((blocker) => blocker.key === 'phase')
    expect(phaseBlocker).toBeTruthy()
    expect(roundBlockerMessage(phaseBlocker!)).toContain(`Fase ${PHASE_2}`)
  })

  it('com rodada aberta, a tela troca a criação pelo fechamento e diz quem não terminou', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Bia Avaliadora')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )

    auth.userId = admin
    const tree = await render(project)
    expect(findElement(tree, NewRound)).toBeNull()

    const props = closeRoundOf(tree)
    expect(props.round.id).toBe(round)
    expect(props.round.roundNumber).toBe(1)
    expect(props.evaluatorsNotFinished).toEqual(['Bia Avaliadora'])

    const confirmation = closeConfirmationLines(
      props.round.roundNumber,
      props.evaluatorsNotFinished,
    ).join(' ')
    expect(confirmation).toContain('irreversível')
    expect(confirmation).toContain('Ainda não terminaram: Bia Avaliadora')
    expect(confirmation).toContain('não depende de todos terem terminado')
  })

  it('com rodada aberta, o seletor recebe os itens, o modelo em uso e as respostas da rodada', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const first = await addInputItem(ownerDb, project, admin, { name: 'Item 1' })
    const second = await addInputItem(ownerDb, project, admin, { name: 'Item 2' })
    const round = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1 },
    )
    await addResponse(ownerDb, round, first, admin)

    auth.userId = admin
    const props = generateOf(await render(project))

    expect(props.round.id).toBe(round)
    expect(props.round.roundNumber).toBe(1)
    expect(props.model).toBe(llmModel())
    expect(props.items.map((item) => item.id)).toEqual([first, second])
    expect(props.generated).toHaveLength(1)
    expect(props.generated[0].itemId).toBe(first)
    expect(props.generated[0].itemName).toBe('Item 1')
    expect(formatDate(props.generated[0].createdAt)).toBeTruthy()
  })

  it('o seletor diz em quais rodadas cada item já produziu resposta, sem tirar ninguém da lista', async () => {
    const admin = await newUser('Admin')
    const { project, codebookVersion, promptVersion } = await readyProject(admin)
    const reused = await addInputItem(ownerDb, project, admin, { name: 'Item reaproveitado' })
    const fresh = await addInputItem(ownerDb, project, admin, { name: 'Item novo' })
    const closed = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 1, status: 'closed' },
    )
    const open = await addRound(
      ownerDb,
      project,
      admin,
      codebookVersion,
      promptVersion,
      { roundNumber: 2 },
    )
    await addResponse(ownerDb, closed, reused, admin)
    await addResponse(ownerDb, open, reused, admin)

    auth.userId = admin
    const props = generateOf(await render(project))

    expect(props.items.map((item) => item.id)).toEqual([reused, fresh])
    expect(props.usage[reused]).toEqual([1, 2])
    expect(props.usage[fresh]).toBeUndefined()
    expect(itemUsageLabel(props.usage[reused])).toBe('usado nas rodadas 1, 2')
    expect(props.generated.map((response) => response.itemId)).toEqual([reused])
  })

  it('o avaliador não alcança a área de rodadas', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const { project } = await readyProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o membro em onboarding é mandado concluir o onboarding', async () => {
    const admin = await newUser('Admin')
    const invited = await newUser('Convidado')
    const { project } = await readyProject(admin)
    await addPendingMember(ownerDb, project, invited)

    auth.userId = invited
    await expect(render(project)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${project}/onboarding`,
    )
  })

  it('quem não é membro não alcança a área de rodadas', async () => {
    const admin = await newUser('Admin')
    const stranger = await newUser('Estranho')
    const { project } = await readyProject(admin)

    auth.userId = stranger
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })
})
