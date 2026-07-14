// app/onboarding/actions.int.test.ts — testes de integração das Server Actions de
// onboarding (issue #22, Fase 1, commit 7). Provam as checagens EXPLÍCITAS que passam a
// gatear o "entrar num projeto" e o "responder o onboarding" — com a RLS de backstop:
//   • acceptInvitation exige convite pendente (hasPendingInvitation, espelha pm_insert);
//   • completeOnboarding só responde pela própria linha pending (can_answer_onboarding).
// Portam os casos de 04_accept_onboarding_members / 06_onboarding_questions.
//
// Cada action commita via `withUser`: fixtures via `ownerDb`, limpas por `cleanup()`.
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', () => ({
  getClaims: async () => (auth.userId ? { sub: auth.userId } : null),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import { acceptInvitation, completeOnboarding } from '@/app/onboarding/actions'
import { ownerDb, projectMembers, projectInvitations, onboardingResponses } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addPendingInvitation,
  addPendingMember,
  addActiveEvaluator,
  addOnboardingQuestion,
  cleanup,
} from '@/test/helpers'

function fd(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

// Executa a action e devolve o destino do redirect (as actions de onboarding sempre
// redirecionam ao final).
async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (e) {
    return (e as Error).message
  }
  throw new Error('esperava um redirect, mas a action retornou normalmente')
}

describe('app/onboarding/actions — entrar/responder com checagem explícita', () => {
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

  it('acceptInvitation: sem convite → não entra; com convite → vira membro pendente', async () => {
    const admin = await newUser('Admin')
    const invited = await newUser('Convidado')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)
    await addPendingInvitation(ownerDb, project, invited, admin)

    // Sem convite pendente: nenhuma linha criada, volta à página do projeto.
    auth.userId = outsider
    expect(await redirectOf(() => acceptInvitation(fd({ project_id: project })))).toBe(
      `NEXT_REDIRECT:/projects/${project}`,
    )
    const outsiderRows = await ownerDb
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project), eq(projectMembers.userId, outsider)))
    expect(outsiderRows).toHaveLength(0)

    // Convidado: materializa a linha pendente e marca o convite como aceito.
    auth.userId = invited
    expect(await redirectOf(() => acceptInvitation(fd({ project_id: project })))).toBe(
      `NEXT_REDIRECT:/projects/${project}/onboarding`,
    )
    const [member] = await ownerDb
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project), eq(projectMembers.userId, invited)))
    expect(member.status).toBe('pending_onboarding')
    const [invitation] = await ownerDb
      .select({ status: projectInvitations.status })
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.projectId, project),
          eq(projectInvitations.inviteeId, invited),
        ),
      )
    expect(invitation.status).toBe('accepted')
  })

  it('completeOnboarding: o membro pendente conclui (ativa + grava resposta)', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    const memberRow = await addPendingMember(ownerDb, project, evaluator)
    const question = await addOnboardingQuestion(ownerDb, project, { text: 'Sua formação?' })

    auth.userId = evaluator
    expect(
      await redirectOf(() =>
        completeOnboarding(
          null,
          fd({ project_id: project, consent: 'on', [`q_${question}`]: 'Ciência da Computação' }),
        ),
      ),
    ).toBe(`NEXT_REDIRECT:/projects/${project}`)

    const [member] = await ownerDb
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(eq(projectMembers.id, memberRow))
    expect(member.status).toBe('active')
    const responses = await ownerDb
      .select({ answer: onboardingResponses.answer })
      .from(onboardingResponses)
      .where(eq(onboardingResponses.projectMemberId, memberRow))
    expect(responses).toHaveLength(1)
    expect(responses[0].answer).toBe('Ciência da Computação')
  })

  it('completeOnboarding: quem não está pending_onboarding não grava resposta', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    const memberRow = await addActiveEvaluator(ownerDb, project, evaluator)
    const question = await addOnboardingQuestion(ownerDb, project, { text: 'Sua formação?' })

    // Já está `active`: a action trata como concluído e não reinsere respostas.
    auth.userId = evaluator
    await redirectOf(() =>
      completeOnboarding(null, fd({ project_id: project, consent: 'on', [`q_${question}`]: 'nova' })),
    )
    const responses = await ownerDb
      .select({ id: onboardingResponses.id })
      .from(onboardingResponses)
      .where(eq(onboardingResponses.projectMemberId, memberRow))
    expect(responses).toHaveLength(0)
  })
})
