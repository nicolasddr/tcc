// app/projects/[id]/responses/[userId]/page.int.test.ts — teste de integração do ESCOPO
// da página de respostas de onboarding (issue #22, Fase 1, commit 8). Porta o caso do
// pgTAP (06_onboarding_questions: "quem não pode ver, não vê"): só o admin do projeto
// enxerga as respostas de um avaliador — os demais são redirecionados. Prova a checagem
// EXPLÍCITA (`isAdmin`, espelha can_view_response), com a RLS de backstop.
//
// A página é um Server Component: renderizá-la só monta a árvore. Acessos commitam via
// `withUser`: fixtures via `ownerDb`, limpas por `cleanup()`.
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`).
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

import MemberResponsesPage from '@/app/projects/[id]/responses/[userId]/page'
import { ownerDb } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addOnboardingQuestion,
  addOnboardingResponse,
  cleanup,
} from '@/test/helpers'

function render(id: string, userId: string) {
  return MemberResponsesPage({ params: Promise.resolve({ id, userId }) })
}

describe('app/projects/[id]/responses/[userId] — só o admin vê as respostas', () => {
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

  it('um avaliador não vê as respostas de outro (redirect); o admin vê', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const other = await newUser('Outro Avaliador')
    const project = await newProject(admin)
    const memberRow = await addActiveEvaluator(ownerDb, project, evaluator)
    await addActiveEvaluator(ownerDb, project, other)
    const question = await addOnboardingQuestion(ownerDb, project, { text: 'Sua formação?' })
    await addOnboardingResponse(ownerDb, memberRow, question, 'Ciência da Computação')

    // Um avaliador (não-admin) tentando ver as respostas do alvo → redirecionado.
    auth.userId = other
    await expect(render(project, evaluator)).rejects.toThrow(`NEXT_REDIRECT:/projects/${project}`)

    // O admin do projeto vê a página das respostas do avaliador.
    auth.userId = admin
    await expect(render(project, evaluator)).resolves.toBeTruthy()
  })
})
