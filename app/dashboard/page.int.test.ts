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

import Dashboard from '@/app/dashboard/page'
import { AppTopBar } from '@/app/components/app-top-bar'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveAdmin,
  addActiveEvaluator,
  addPendingInvitation,
  setMemberStatus,
  cleanup,
} from '@/test/helpers'

function render() {
  return Dashboard({ searchParams: Promise.resolve({}) })
}

function findByHref(node: unknown, href: string): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByHref(child, href)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const props = node.props as Record<string, unknown>
  if (props.href === href) return node
  for (const value of Object.values(props)) {
    const found = findByHref(value, href)
    if (found) return found
  }
  return null
}

function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (!isValidElement(node)) return ''
  return textOf((node.props as { children?: unknown }).children)
}

function cardTextOf(tree: unknown, projectId: string): string {
  const link = findByHref(tree, `/projects/${projectId}`)
  expect(link).not.toBeNull()
  return textOf(link).replace(/\s+/g, ' ').trim()
}

describe('app/dashboard — fase de cada projeto', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
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

  it('mostra a fase ao lado do papel', async () => {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto na Fase 1')
    projs.push(project)

    auth.userId = admin
    const text = cardTextOf(await render(), project)

    expect(text).toContain('Administrador · Fase 1 de 4, Configuração inicial')
  })

  it('junta os papéis e a fase de cada projeto', async () => {
    const admin = await newUser('Admin')
    const other = await newUser('Outro')
    const both = await seedProject(ownerDb, admin, 'Projeto na Fase 3', { phase: 3 })
    const evaluatorOnly = await seedProject(ownerDb, other, 'Projeto na Fase 4', { phase: 4 })
    projs.push(both, evaluatorOnly)
    await addActiveEvaluator(ownerDb, both, admin)
    await addActiveEvaluator(ownerDb, evaluatorOnly, admin)

    auth.userId = admin
    const tree = await render()

    expect(cardTextOf(tree, both)).toContain(
      'Administrador · Avaliador · Fase 3 de 4, Validação do prompt',
    )
    expect(cardTextOf(tree, evaluatorOnly)).toContain('Avaliador · Fase 4 de 4, Validação final')
  })

  it('não lista o projeto de quem só tem vínculo inativo, nem o do criador rebaixado', async () => {
    const creator = await newUser('Criador')
    const admin = await newUser('Admin')
    const deactivated = await newUser('Desativado')
    const formerAdmin = await newUser('Ex-admin')
    const project = await seedProject(ownerDb, creator, 'Projeto de onde saíram')
    projs.push(project)
    await addActiveAdmin(ownerDb, project, admin)
    await addActiveEvaluator(ownerDb, project, deactivated)
    await addActiveAdmin(ownerDb, project, formerAdmin)
    await setMemberStatus(ownerDb, project, deactivated, 'evaluator', 'inactive')
    await setMemberStatus(ownerDb, project, formerAdmin, 'administrator', 'inactive')
    await setMemberStatus(ownerDb, project, creator, 'administrator', 'inactive')

    for (const userId of [deactivated, formerAdmin, creator]) {
      auth.userId = userId
      const tree = await render()
      expect(findByHref(tree, `/projects/${project}`)).toBeNull()
      expect(textOf(tree)).toContain('Você ainda não participa de nenhum projeto')
    }
  })

  it('o administrador com o vínculo de avaliador inativo aparece só como Administrador', async () => {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto na Fase 1')
    projs.push(project)
    await addActiveEvaluator(ownerDb, project, admin)
    await setMemberStatus(ownerDb, project, admin, 'evaluator', 'inactive')

    auth.userId = admin
    const text = cardTextOf(await render(), project)

    expect(text).toContain('Administrador · Fase 1 de 4')
    expect(text).not.toContain('Avaliador')
  })

  it('o convite para quem tem vínculo inativo aparece com Aceitar e Recusar', async () => {
    const admin = await newUser('Admin')
    const readmitted = await newUser('Reconvidado')
    const project = await seedProject(ownerDb, admin, 'Projeto de volta')
    projs.push(project)
    await addActiveEvaluator(ownerDb, project, readmitted)
    await setMemberStatus(ownerDb, project, readmitted, 'evaluator', 'inactive')
    await addPendingInvitation(ownerDb, project, readmitted, admin)

    auth.userId = readmitted
    const text = textOf(await render()).replace(/\s+/g, ' ')

    expect(text).toContain('Convite pendente')
    expect(text).toContain('Aceitar')
    expect(text).toContain('Recusar')
    expect(text).not.toContain('Avaliador')
  })

  it('usa a barra do topo comum, com a trilha em Meus projetos', async () => {
    const admin = await newUser('Admin')

    auth.userId = admin
    const tree = (await render()) as ReactElement<{ header: ReactElement }>
    const header = tree.props.header

    expect(header.type).toBe(AppTopBar)
    expect(header.props).toEqual({ trail: [{ label: 'Meus projetos' }] })
  })

  it('não tem o rodapé das fases do processo', async () => {
    const admin = await newUser('Admin')

    auth.userId = admin
    const tree = (await render()) as ReactElement<{ footer?: unknown }>

    expect(tree.props.footer).toBeUndefined()
  })
})
