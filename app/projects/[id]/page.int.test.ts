// app/projects/[id]/page.int.test.ts — teste de integração do ESCOPO de visibilidade
// da página do projeto (issue #22, Fase 1, commit 5). Porta o caso de comportamento
// externo que o pgTAP afirma sob RLS ("quem não participa não enxerga o projeto",
// 08_project_lifecycle), agora provando a checagem EXPLÍCITA (`canView` → notFound) que
// a página passa a fazer na app — com a RLS ainda ligada como backstop.
//
// A página é um Server Component: renderizá-la aqui só monta a árvore de elementos
// (nenhum componente-cliente executa). Cada acesso commita via `withUser`, então as
// fixtures são gravadas por `ownerDb` e limpas por `cleanup()`.
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', () => ({
  getClaims: async () => (auth.userId ? { sub: auth.userId } : null),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOTFOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import ProjectPage from '@/app/projects/[id]/page'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingInvitation,
  cleanup,
} from '@/test/helpers'

function render(id: string) {
  return ProjectPage({ params: Promise.resolve({ id }) })
}

describe('app/projects/[id]/page — escopo de visibilidade (RLS como backstop)', () => {
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

  it('quem não participa não enxerga o projeto (notFound)', async () => {
    const admin = await newUser('Admin')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)

    auth.userId = outsider
    await expect(render(project)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o criador/admin, um membro e um convidado pendente enxergam', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const invited = await newUser('Convidado')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    await addPendingInvitation(ownerDb, project, invited, admin)

    auth.userId = admin
    await expect(render(project)).resolves.toBeTruthy()
    auth.userId = evaluator
    await expect(render(project)).resolves.toBeTruthy()
    auth.userId = invited
    await expect(render(project)).resolves.toBeTruthy()
  })
})
