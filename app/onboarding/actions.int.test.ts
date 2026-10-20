// app/onboarding/actions.int.test.ts — testes de integração das Server Actions de
// onboarding (issue #22). Provam as checagens EXPLÍCITAS que gateiam o "entrar num
// projeto" e o "responder o onboarding":
//   • acceptInvitation exige convite pendente (hasPendingInvitation);
//   • completeOnboarding só responde pela própria linha pending.
//
// Cada action commita via `transaction`: fixtures via `ownerDb`, limpas por `cleanup()`.
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import { abandonOnboarding, acceptInvitation, completeOnboarding } from '@/app/onboarding/actions'
import { CONSENT_TEXT } from '@/app/onboarding/consent'
import {
  ownerDb,
  projectMembers,
  projectInvitations,
  onboardingResponses,
  evaluations,
} from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addPendingInvitation,
  addPendingMember,
  addActiveEvaluator,
  addOnboardingQuestion,
  addOnboardingResponse,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  addEvaluation,
  setMemberStatus,
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

  it('completeOnboarding: o administrador que assumiu o papel ativa o vínculo de avaliador', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const question = await addOnboardingQuestion(ownerDb, project)
    const evaluatorLink = await addPendingMember(ownerDb, project, admin)

    auth.userId = admin
    const to = await redirectOf(() =>
      completeOnboarding(
        null,
        fd({
          project_id: project,
          consent: 'on',
          [`q_${question}`]: 'Também avalio neste projeto.',
        }),
      ),
    )
    expect(to).toBe(`NEXT_REDIRECT:/projects/${project}`)

    const rows = await ownerDb
      .select({
        role: projectMembers.role,
        status: projectMembers.status,
        consentAcceptedAt: projectMembers.consentAcceptedAt,
        consentTextSnapshot: projectMembers.consentTextSnapshot,
      })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, project), eq(projectMembers.userId, admin)),
      )

    const evaluator = rows.find((r) => r.role === 'evaluator')!
    expect(evaluator.status).toBe('active')
    expect(evaluator.consentAcceptedAt).not.toBeNull()
    expect(evaluator.consentTextSnapshot).toBe(CONSENT_TEXT)
    expect(rows.find((r) => r.role === 'administrator')!.status).toBe('active')

    const answers = await ownerDb
      .select({ projectMemberId: onboardingResponses.projectMemberId })
      .from(onboardingResponses)
      .where(eq(onboardingResponses.projectMemberId, evaluatorLink))
    expect(answers).toHaveLength(1)
  })
})

describe('app/onboarding/actions — readmissão pelo mesmo vínculo', () => {
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

  async function memberOf(project: string, userId: string) {
    const rows = await ownerDb
      .select({
        id: projectMembers.id,
        status: projectMembers.status,
        consentTextSnapshot: projectMembers.consentTextSnapshot,
      })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project),
          eq(projectMembers.userId, userId),
          eq(projectMembers.role, 'evaluator'),
        ),
      )
    expect(rows).toHaveLength(1)
    return rows[0]
  }

  async function invitationStatuses(project: string, userId: string) {
    const rows = await ownerDb
      .select({ status: projectInvitations.status })
      .from(projectInvitations)
      .where(
        and(eq(projectInvitations.projectId, project), eq(projectInvitations.inviteeId, userId)),
      )
    return rows.map((r) => r.status).toSorted()
  }

  async function evaluated(project: string, admin: string, memberRow: string) {
    const codebook = await addCodebookVersion(ownerDb, project, admin)
    const prompt = await addPromptVersion(ownerDb, project, admin)
    const item = await addInputItem(ownerDb, project, admin)
    const round = await addRound(ownerDb, project, admin, codebook, prompt)
    const response = await addResponse(ownerDb, round, item, admin)
    return addEvaluation(ownerDb, round, response, memberRow)
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o desativado reconvidado aceita, refaz o onboarding e volta ativo na mesma linha, com as respostas novas no lugar das antigas', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    const question = await addOnboardingQuestion(ownerDb, project, { text: 'Sua formação?' })
    const memberRow = await addActiveEvaluator(ownerDb, project, evaluator)
    await addOnboardingResponse(ownerDb, memberRow, question, 'Resposta antiga')
    const evaluation = await evaluated(project, admin, memberRow)
    await setMemberStatus(ownerDb, project, evaluator, 'evaluator', 'inactive')
    await addPendingInvitation(ownerDb, project, evaluator, admin)

    auth.userId = evaluator
    expect(await redirectOf(() => acceptInvitation(fd({ project_id: project })))).toBe(
      `NEXT_REDIRECT:/projects/${project}/onboarding`,
    )
    const accepted = await memberOf(project, evaluator)
    expect(accepted.id).toBe(memberRow)
    expect(accepted.status).toBe('pending_onboarding')
    expect(await invitationStatuses(project, evaluator)).toEqual(['accepted'])

    expect(
      await redirectOf(() =>
        completeOnboarding(
          null,
          fd({ project_id: project, consent: 'on', [`q_${question}`]: 'Resposta nova' }),
        ),
      ),
    ).toBe(`NEXT_REDIRECT:/projects/${project}`)

    const back = await memberOf(project, evaluator)
    expect(back.id).toBe(memberRow)
    expect(back.status).toBe('active')
    expect(back.consentTextSnapshot).toBe(CONSENT_TEXT)

    const answers = await ownerDb
      .select({ answer: onboardingResponses.answer })
      .from(onboardingResponses)
      .where(eq(onboardingResponses.projectMemberId, memberRow))
    expect(answers.map((a) => a.answer)).toEqual(['Resposta nova'])

    const kept = await ownerDb
      .select({ projectMemberId: evaluations.projectMemberId })
      .from(evaluations)
      .where(eq(evaluations.id, evaluation))
    expect(kept).toEqual([{ projectMemberId: memberRow }])
  })

  it('sem convite pendente, aceitar não mexe no vínculo inativo', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    await setMemberStatus(ownerDb, project, evaluator, 'evaluator', 'inactive')

    auth.userId = evaluator
    expect(await redirectOf(() => acceptInvitation(fd({ project_id: project })))).toBe(
      `NEXT_REDIRECT:/projects/${project}`,
    )
    expect((await memberOf(project, evaluator)).status).toBe('inactive')

    await redirectOf(() => completeOnboarding(null, fd({ project_id: project, consent: 'on' })))
    expect((await memberOf(project, evaluator)).status).toBe('inactive')
  })

  it('desistir do onboarding da readmissão devolve o vínculo a inativo e o convite a pendente, sem apagar as avaliações', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    const memberRow = await addActiveEvaluator(ownerDb, project, evaluator)
    const evaluation = await evaluated(project, admin, memberRow)
    await ownerDb
      .insert(projectInvitations)
      .values({
        projectId: project,
        inviteeId: evaluator,
        inviteeEmail: 'primeiro-convite@example.com',
        invitedBy: admin,
        status: 'accepted',
        resolvedAt: '2026-01-01T00:00:00Z',
      })
    await setMemberStatus(ownerDb, project, evaluator, 'evaluator', 'inactive')
    await addPendingInvitation(ownerDb, project, evaluator, admin)

    auth.userId = evaluator
    await redirectOf(() => acceptInvitation(fd({ project_id: project })))
    expect(await redirectOf(() => abandonOnboarding(fd({ project_id: project })))).toBe(
      'NEXT_REDIRECT:/dashboard',
    )

    const after = await memberOf(project, evaluator)
    expect(after.id).toBe(memberRow)
    expect(after.status).toBe('inactive')
    expect(await invitationStatuses(project, evaluator)).toEqual(['accepted', 'pending'])

    const kept = await ownerDb
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(eq(evaluations.id, evaluation))
    expect(kept).toHaveLength(1)
  })
})
