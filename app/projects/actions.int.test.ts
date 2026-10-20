// app/projects/actions.int.test.ts — testes de integração das Server Actions de
// projetos (issue #22). Provam o COMPORTAMENTO EXTERNO de autorização (quem pode o quê)
// através da checagem EXPLÍCITA que as actions fazem na app-layer.
//
// Diferente de `lib/authz.int.test.ts`, aqui NÃO dá para usar `inRollbackTx`: cada
// action abre a própria transação (`transaction`) e COMMITA. Então as fixtures são
// gravadas via `ownerDb` e removidas por `cleanup()` no fim de cada teste.
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'

// Estado do "usuário logado" que o mock de getClaims lê. `vi.hoisted` garante que
// existe antes do factory do mock (que o vitest içar acima dos imports).
const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  // As actions chamam redirect() no sucesso (createProject) — o Next lança uma
  // exceção de controle; aqui codificamos o destino na mensagem p/ inspecionar.
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import {
  createProject,
  updateProject,
  setProjectStatus,
  deactivateMember,
  leaveProject,
  inviteEvaluator,
  assumeEvaluatorRole,
  revokeEvaluatorRole,
  grantAdminRole,
  revokeAdminRole,
} from '@/app/projects/actions'
import {
  GRANT_ALREADY_ADMIN,
  GRANT_DENIED,
  GRANT_NOT_ACTIVE_EVALUATOR,
  REVOKE_ADMIN_DENIED,
  REVOKE_LAST_ADMIN,
  REVOKE_NOT_ADMIN,
} from '@/app/projects/admin-role'
import {
  ASSUME_ALREADY_EVALUATOR,
  ASSUME_DENIED,
  REVOKE_DENIED,
  REVOKE_NO_LINK,
} from '@/app/projects/evaluator-link'
import {
  ownerDb,
  profiles,
  projects,
  projectMembers,
  projectInvitations,
  notifications,
  onboardingResponses,
  codebookCriteria,
  consensusNotes,
} from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addActiveAdmin,
  addPendingMember,
  addPendingInvitation,
  addOnboardingQuestion,
  addOnboardingResponse,
  grantCreatePermission,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  addConsensusNote,
  cleanup,
} from '@/test/helpers'

function fd(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

describe('app/projects/actions — autorização explícita', () => {
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

  it('createProject: sem can_create_projects → erro; com → cria e vira admin ativo', async () => {
    const admin = await newUser('Admin')

    auth.userId = admin
    const denied = await createProject(null, fd({ name: 'Projeto X' }))
    expect(denied).toEqual({ error: expect.stringContaining('permissão') })

    await grantCreatePermission(ownerDb, admin)
    let redirected = ''
    try {
      await createProject(null, fd({ name: 'Projeto X', task_type: 'classification' }))
    } catch (e) {
      redirected = (e as Error).message
    }
    expect(redirected).toMatch(/^NEXT_REDIRECT:\/projects\//)
    const newId = redirected.split('/projects/')[1]
    projs.push(newId)

    // A app materializa o criador como admin ativo (insert explícito). EXATAMENTE uma
    // linha: o insert é idempotente (onConflictDoNothing sobre pm_unique_role).
    const admins = await ownerDb
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, newId),
          eq(projectMembers.userId, admin),
          eq(projectMembers.role, 'administrator'),
        ),
      )
    expect(admins).toHaveLength(1)
    expect(admins[0].status).toBe('active')
  })

  it('updateProject: avaliador/estranho → erro e nome inalterado; admin → salva', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const stranger = await newUser('Estranho')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    expect(await updateProject(null, fd({ project_id: project, name: 'invasao' }))).toEqual({
      error: expect.stringContaining('administrador'),
    })
    auth.userId = stranger
    expect(await updateProject(null, fd({ project_id: project, name: 'invasao2' }))).toEqual({
      error: expect.stringContaining('administrador'),
    })

    const [before] = await ownerDb
      .select({ name: projects.name, updatedAt: projects.updatedAt })
      .from(projects)
      .where(eq(projects.id, project))
    expect(before.name).toBe('Projeto de Teste')

    auth.userId = admin
    expect(await updateProject(null, fd({ project_id: project, name: 'Editado' }))).toEqual({
      ok: expect.any(String),
    })
    const [after] = await ownerDb
      .select({ name: projects.name, updatedAt: projects.updatedAt })
      .from(projects)
      .where(eq(projects.id, project))
    expect(after.name).toBe('Editado')
    // O UPDATE emite `updated_at = now()` via $onUpdate (schema.ts): fica não-nulo e
    // avança em relação ao valor pré-edição.
    expect(after.updatedAt).not.toBeNull()
    expect(after.updatedAt).not.toBe(before.updatedAt)
  })

  it('setProjectStatus: avaliador → no-op; admin → muda o status', async () => {
    const admin = await newUser()
    const evaluator = await newUser()
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    await setProjectStatus(fd({ project_id: project, from: 'active', to: 'completed' }))
    const [stillActive] = await ownerDb
      .select({ status: projects.status })
      .from(projects)
      .where(eq(projects.id, project))
    expect(stillActive.status).toBe('active')

    auth.userId = admin
    await setProjectStatus(fd({ project_id: project, from: 'active', to: 'completed' }))
    const [completed] = await ownerDb
      .select({ status: projects.status })
      .from(projects)
      .where(eq(projects.id, project))
    expect(completed.status).toBe('completed')
  })

  it('deactivateMember: não-admin → no-op; admin → inativa e cancela convite pendente', async () => {
    const admin = await newUser()
    const evaluator = await newUser()
    const outsider = await newUser()
    const project = await newProject(admin)
    // Convite ANTES de virar membro ativo (não se convida quem já é membro ativo).
    await addPendingInvitation(ownerDb, project, evaluator, admin)
    const memberRow = await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = outsider
    await deactivateMember(fd({ project_id: project, member_user_id: evaluator }))
    const [untouched] = await ownerDb
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(eq(projectMembers.id, memberRow))
    expect(untouched.status).toBe('active')

    auth.userId = admin
    await deactivateMember(fd({ project_id: project, member_user_id: evaluator }))
    const [removed] = await ownerDb
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(eq(projectMembers.id, memberRow))
    expect(removed.status).toBe('inactive')
    const [invitation] = await ownerDb
      .select({ status: projectInvitations.status })
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.projectId, project),
          eq(projectInvitations.inviteeId, evaluator),
        ),
      )
    expect(invitation.status).toBe('cancelled')
  })

  it('inviteEvaluator: só o admin convida (não-admin não grava nada)', async () => {
    const admin = await newUser()
    const evaluator = await newUser()
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const denied = await inviteEvaluator(null, fd({ project_id: project, email: 'novo@test.local' }))
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    const nothing = await ownerDb
      .select({ id: projectInvitations.id })
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project))
    expect(nothing).toHaveLength(0)

    auth.userId = admin
    const ok = await inviteEvaluator(null, fd({ project_id: project, email: 'novo@test.local' }))
    expect(ok).toHaveProperty('ok')
    const [created] = await ownerDb
      .select({ status: projectInvitations.status })
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project))
    expect(created.status).toBe('pending')
  })

  it('inviteEvaluator: administrador do projeto resolve o convidado mesmo sem can_create_projects', async () => {
    const admin = await newUser('Admin')
    const invitee = await newUser('Convidado')
    const project = await newProject(admin)
    const [{ email }] = await ownerDb
      .select({ email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, invitee))

    auth.userId = admin
    const asInviter = await inviteEvaluator(null, fd({ project_id: project, email }))
    expect(asInviter).toEqual({ ok: expect.stringContaining('Convidado') })
    const [resolved] = await ownerDb
      .select({ id: projectInvitations.id, inviteeId: projectInvitations.inviteeId })
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project))
    expect(resolved.inviteeId).toBe(invitee)

    // O convidado já-cadastrado recebe EXATAMENTE uma notificação: a guarda not-exists por
    // invitation_id mantém o insert idempotente. Payload denormalizado com nome do projeto.
    const notes = await ownerDb
      .select({ type: notifications.type, payload: notifications.payload })
      .from(notifications)
      .where(eq(notifications.userId, invitee))
    expect(notes).toHaveLength(1)
    expect(notes[0].type).toBe('project_invitation')
    expect(notes[0].payload).toMatchObject({
      invitation_id: resolved.id,
      project_id: project,
      invited_by: admin,
      inviter_name: 'Admin',
    })
  })

  // --- regras de negócio como guarda na app ------------------------------------------
  // Cada teste prova, através da action real, a regra de negócio na app-layer.

  // Projeto completed/archived é somente leitura p/ nome/descrição.
  it('updateProject: projeto concluído é somente leitura', async () => {
    const admin = await newUser()
    const project = await newProject(admin)
    // Concluir via fixture direta: o `where status='active'` do UPDATE passa a casar 0 linhas.
    await ownerDb.update(projects).set({ status: 'completed' }).where(eq(projects.id, project))

    auth.userId = admin
    expect(await updateProject(null, fd({ project_id: project, name: 'Tentativa' }))).toEqual({
      error: expect.stringContaining('somente leitura'),
    })
    const [after] = await ownerDb
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, project))
    expect(after.name).toBe('Projeto de Teste')
  })

  // Não convidar quem já é membro ATIVO do projeto.
  it('inviteEvaluator: recusa convidar quem já é membro ativo', async () => {
    const admin = await newUser()
    const evaluator = await newUser('Avaliador Ativo')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const [{ email }] = await ownerDb
      .select({ email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, evaluator))

    auth.userId = admin
    const denied = await inviteEvaluator(null, fd({ project_id: project, email }))
    expect(denied).toEqual({ error: expect.stringContaining('já é membro ativo') })
    // O pré-check barra ANTES da escrita: nenhum convite é gravado.
    const invites = await ownerDb
      .select({ id: projectInvitations.id })
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project))
    expect(invites).toHaveLength(0)
  })

  // O avaliador só faz active→inactive na PRÓPRIA linha; não existe caminho de app para
  // reativar-se (inactive→active).
  it('leaveProject: sai (active→inactive próprio) e não reativa a própria linha depois', async () => {
    const admin = await newUser()
    const evaluator = await newUser()
    const project = await newProject(admin)
    const memberRow = await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    let redirected = ''
    try {
      await leaveProject(fd({ project_id: project }))
    } catch (e) {
      redirected = (e as Error).message
    }
    expect(redirected).toBe('NEXT_REDIRECT:/dashboard')
    const [left] = await ownerDb
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(eq(projectMembers.id, memberRow))
    expect(left.status).toBe('inactive')

    // Chamar de novo (já inactive): o filtro `status='active'` casa 0 linhas → segue inactive.
    // Nenhuma action oferece inactive→active, então o furo de auto-reativação fica fechado.
    await leaveProject(fd({ project_id: project })).catch(() => {})
    const [still] = await ownerDb
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(eq(projectMembers.id, memberRow))
    expect(still.status).toBe('inactive')
  })

  it('assumeEvaluatorRole: só o admin do projeto assume, e o vínculo novo nasce pendente', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const outsider = await newUser('De Fora')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    for (const caller of [evaluator, outsider]) {
      auth.userId = caller
      expect(await assumeEvaluatorRole(null, fd({ project_id: project }))).toEqual({
        error: ASSUME_DENIED,
      })
    }

    auth.userId = admin
    let redirected = ''
    try {
      await assumeEvaluatorRole(null, fd({ project_id: project }))
    } catch (e) {
      redirected = (e as Error).message
    }
    expect(redirected).toBe(`NEXT_REDIRECT:/projects/${project}/onboarding`)

    const rows = await ownerDb
      .select({
        role: projectMembers.role,
        status: projectMembers.status,
        consentAcceptedAt: projectMembers.consentAcceptedAt,
        onboardingCompletedAt: projectMembers.onboardingCompletedAt,
      })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, project), eq(projectMembers.userId, admin)),
      )
    expect(rows).toHaveLength(2)

    const evaluatorLink = rows.find((r) => r.role === 'evaluator')!
    expect(evaluatorLink.status).toBe('pending_onboarding')
    expect(evaluatorLink.consentAcceptedAt).toBeNull()
    expect(evaluatorLink.onboardingCompletedAt).toBeNull()
    expect(rows.find((r) => r.role === 'administrator')!.status).toBe('active')

    expect(await assumeEvaluatorRole(null, fd({ project_id: project }))).toEqual({
      error: ASSUME_ALREADY_EVALUATOR,
    })
    const again = await ownerDb
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, project), eq(projectMembers.userId, admin)),
      )
    expect(again).toHaveLength(2)
  })

  it('assumeEvaluatorRole: o admin com o vínculo de avaliador inativo volta a pending_onboarding na mesma linha', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const evaluatorLink = await addActiveEvaluator(ownerDb, project, admin)
    await ownerDb
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(eq(projectMembers.id, evaluatorLink))

    auth.userId = admin
    let redirected = ''
    try {
      await assumeEvaluatorRole(null, fd({ project_id: project }))
    } catch (e) {
      redirected = (e as Error).message
    }
    expect(redirected).toBe(`NEXT_REDIRECT:/projects/${project}/onboarding`)

    const rows = await ownerDb
      .select({ id: projectMembers.id, role: projectMembers.role, status: projectMembers.status })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, project), eq(projectMembers.userId, admin)),
      )
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.role === 'evaluator')).toEqual({
      id: evaluatorLink,
      role: 'evaluator',
      status: 'pending_onboarding',
    })

    expect(await assumeEvaluatorRole(null, fd({ project_id: project }))).toEqual({
      error: ASSUME_ALREADY_EVALUATOR,
    })
  })

  it('revokeEvaluatorRole: desfaz enquanto não há avaliação e preserva o vínculo de administrador', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    await addPendingMember(ownerDb, project, admin)

    const question = await addOnboardingQuestion(ownerDb, project)
    const [adminEvaluatorLink] = await ownerDb
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project),
          eq(projectMembers.userId, admin),
          eq(projectMembers.role, 'evaluator'),
        ),
      )
    await addOnboardingResponse(ownerDb, adminEvaluatorLink.id, question, 'Resposta do admin.')

    auth.userId = evaluator
    expect(await revokeEvaluatorRole(null, fd({ project_id: project }))).toEqual({
      error: REVOKE_DENIED,
    })

    auth.userId = admin
    expect(await revokeEvaluatorRole(null, fd({ project_id: project }))).toEqual({
      ok: expect.stringContaining('administrador'),
    })

    const rows = await ownerDb
      .select({ role: projectMembers.role, status: projectMembers.status })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, project), eq(projectMembers.userId, admin)),
      )
    expect(rows).toEqual([{ role: 'administrator', status: 'active' }])

    const answers = await ownerDb
      .select({ id: onboardingResponses.id })
      .from(onboardingResponses)
      .where(eq(onboardingResponses.projectMemberId, adminEvaluatorLink.id))
    expect(answers).toHaveLength(0)

    expect(await revokeEvaluatorRole(null, fd({ project_id: project }))).toEqual({
      error: REVOKE_NO_LINK,
    })
  })

  describe('grantAdminRole', () => {
    async function adminRowsOf(project: string, user: string) {
      return ownerDb
        .select({ id: projectMembers.id, role: projectMembers.role, status: projectMembers.status })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, project), eq(projectMembers.userId, user)))
    }

    it('avaliador ativo vira administrador e mantém a linha de avaliador', async () => {
      const admin = await newUser('Admin')
      const evaluator = await newUser('Avaliador')
      const project = await newProject(admin)
      const evaluatorRow = await addActiveEvaluator(ownerDb, project, evaluator)

      auth.userId = admin
      expect(
        await grantAdminRole(null, fd({ project_id: project, member_user_id: evaluator })),
      ).toEqual({ ok: expect.any(String) })

      const rows = await adminRowsOf(project, evaluator)
      expect(rows).toHaveLength(2)
      expect(rows.find((r) => r.role === 'evaluator')).toEqual({
        id: evaluatorRow,
        role: 'evaluator',
        status: 'active',
      })
      expect(rows.find((r) => r.role === 'administrator')!.status).toBe('active')
    })

    it('re-promoção reativa a mesma linha de administrador', async () => {
      const admin = await newUser('Admin')
      const evaluator = await newUser('Avaliador')
      const project = await newProject(admin)
      await addActiveEvaluator(ownerDb, project, evaluator)
      const adminRow = await addActiveAdmin(ownerDb, project, evaluator)
      await ownerDb
        .update(projectMembers)
        .set({ status: 'inactive' })
        .where(eq(projectMembers.id, adminRow))

      auth.userId = admin
      expect(
        await grantAdminRole(null, fd({ project_id: project, member_user_id: evaluator })),
      ).toEqual({ ok: expect.any(String) })

      const admins = (await adminRowsOf(project, evaluator)).filter(
        (r) => r.role === 'administrator',
      )
      expect(admins).toEqual([{ id: adminRow, role: 'administrator', status: 'active' }])
    })

    it('recusas chegam como { error } e não mudam nada no banco', async () => {
      const admin = await newUser('Admin')
      const evaluator = await newUser('Avaliador')
      const pending = await newUser('Em Onboarding')
      const inactive = await newUser('Desativado')
      const outsider = await newUser('De Fora')
      const project = await newProject(admin)
      await addActiveEvaluator(ownerDb, project, evaluator)
      await addPendingMember(ownerDb, project, pending)
      const inactiveRow = await addActiveEvaluator(ownerDb, project, inactive)
      await ownerDb
        .update(projectMembers)
        .set({ status: 'inactive' })
        .where(eq(projectMembers.id, inactiveRow))

      for (const caller of [evaluator, outsider]) {
        auth.userId = caller
        expect(
          await grantAdminRole(null, fd({ project_id: project, member_user_id: evaluator })),
        ).toEqual({ error: GRANT_DENIED })
      }

      auth.userId = admin
      for (const target of [pending, inactive, outsider]) {
        expect(
          await grantAdminRole(null, fd({ project_id: project, member_user_id: target })),
        ).toEqual({ error: GRANT_NOT_ACTIVE_EVALUATOR })
      }
      expect(
        await grantAdminRole(null, fd({ project_id: project, member_user_id: admin })),
      ).toEqual({ error: GRANT_ALREADY_ADMIN })

      const admins = await ownerDb
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(
          and(eq(projectMembers.projectId, project), eq(projectMembers.role, 'administrator')),
        )
      expect(admins).toEqual([{ userId: admin }])
    })
  })

  describe('revokeAdminRole', () => {
    async function adminStatusOf(project: string, user: string) {
      const [row] = await ownerDb
        .select({ id: projectMembers.id, status: projectMembers.status })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, project),
            eq(projectMembers.userId, user),
            eq(projectMembers.role, 'administrator'),
          ),
        )
      return row
    }

    async function writeMinutes(project: string, admin: string, authorRow: string) {
      const codebook = await addCodebookVersion(ownerDb, project, admin, {
        perResponseCriteria: [{ name: 'Clareza' }],
      })
      const [criterion] = await ownerDb
        .select({ id: codebookCriteria.id })
        .from(codebookCriteria)
        .where(eq(codebookCriteria.codebookVersionId, codebook))
      const prompt = await addPromptVersion(ownerDb, project, admin)
      const item = await addInputItem(ownerDb, project, admin)
      const round = await addRound(ownerDb, project, admin, codebook, prompt, {
        status: 'closed',
      })
      const response = await addResponse(ownerDb, round, item, admin)
      return addConsensusNote(ownerDb, {
        roundId: round,
        responseId: response,
        definitionId: null,
        criterionId: criterion.id,
        projectMemberId: authorRow,
        visibility: 'shared',
        text: 'Ata do segundo administrador.',
      })
    }

    it('desativa a linha sem apagá-la, e a ata escrita continua lá', async () => {
      const admin = await newUser('Admin')
      const second = await newUser('Segundo')
      const project = await newProject(admin)
      await addActiveEvaluator(ownerDb, project, second)
      const secondAdminRow = await addActiveAdmin(ownerDb, project, second)
      const note = await writeMinutes(project, admin, secondAdminRow)

      auth.userId = admin
      expect(
        await revokeAdminRole(null, fd({ project_id: project, member_user_id: second })),
      ).toEqual({ ok: expect.any(String) })

      expect(await adminStatusOf(project, second)).toEqual({
        id: secondAdminRow,
        status: 'inactive',
      })
      const notes = await ownerDb
        .select({ id: consensusNotes.id, author: consensusNotes.projectMemberId })
        .from(consensusNotes)
        .where(eq(consensusNotes.id, note))
      expect(notes).toEqual([{ id: note, author: secondAdminRow }])
    })

    it('recusa quem não é admin, alvo sem papel e o último administrador', async () => {
      const admin = await newUser('Admin')
      const evaluator = await newUser('Avaliador')
      const project = await newProject(admin)
      await addActiveEvaluator(ownerDb, project, evaluator)

      auth.userId = evaluator
      expect(
        await revokeAdminRole(null, fd({ project_id: project, member_user_id: admin })),
      ).toEqual({ error: REVOKE_ADMIN_DENIED })

      auth.userId = admin
      expect(
        await revokeAdminRole(null, fd({ project_id: project, member_user_id: evaluator })),
      ).toEqual({ error: REVOKE_NOT_ADMIN })
      expect(
        await revokeAdminRole(null, fd({ project_id: project, member_user_id: admin })),
      ).toEqual({ error: REVOKE_LAST_ADMIN })

      expect((await adminStatusOf(project, admin)).status).toBe('active')
    })

    it('remover a si mesmo com vínculo de avaliador devolve { ok }', async () => {
      const admin = await newUser('Admin')
      const second = await newUser('Segundo')
      const project = await newProject(admin)
      await addActiveEvaluator(ownerDb, project, second)
      await addActiveAdmin(ownerDb, project, second)

      auth.userId = second
      expect(
        await revokeAdminRole(null, fd({ project_id: project, member_user_id: second })),
      ).toEqual({ ok: expect.any(String) })
      expect((await adminStatusOf(project, second)).status).toBe('inactive')
    })

    it('remover a si mesmo sem vínculo de avaliador redireciona ao painel', async () => {
      const admin = await newUser('Admin')
      const second = await newUser('Segundo')
      const project = await newProject(admin)
      await addActiveEvaluator(ownerDb, project, second)
      await addActiveAdmin(ownerDb, project, second)

      auth.userId = admin
      let redirected = ''
      try {
        await revokeAdminRole(null, fd({ project_id: project, member_user_id: admin }))
      } catch (e) {
        redirected = (e as Error).message
      }
      expect(redirected).toBe('NEXT_REDIRECT:/dashboard')
      expect((await adminStatusOf(project, admin)).status).toBe('inactive')
      expect((await adminStatusOf(project, second)).status).toBe('active')
    })

    it('remoção cruzada espera a outra terminar e não deixa o projeto sem administrador', async () => {
      const first = await newUser('Primeiro')
      const second = await newUser('Segundo')
      const project = await newProject(first)
      await addActiveAdmin(ownerDb, project, second)
      const activeAdminsOf = () =>
        and(
          eq(projectMembers.projectId, project),
          eq(projectMembers.role, 'administrator'),
          eq(projectMembers.status, 'active'),
        )

      let release!: () => void
      const held = new Promise<void>((resolve) => (release = resolve))
      let markLocked!: () => void
      const locked = new Promise<void>((resolve) => (markLocked = resolve))
      const secondRemovesFirst = ownerDb.transaction(async (tx) => {
        await tx
          .select({ id: projectMembers.id })
          .from(projectMembers)
          .where(activeAdminsOf())
          .for('update')
        await tx
          .update(projectMembers)
          .set({ status: 'inactive' })
          .where(and(activeAdminsOf(), eq(projectMembers.userId, first)))
        markLocked()
        await held
      })
      await locked

      auth.userId = first
      const firstRemovesSecond = revokeAdminRole(
        null,
        fd({ project_id: project, member_user_id: second }),
      )
      await new Promise((resolve) => setTimeout(resolve, 200))
      release()
      await secondRemovesFirst

      expect(await firstRemovesSecond).toEqual({ error: REVOKE_ADMIN_DENIED })
      const active = await ownerDb
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(activeAdminsOf())
      expect(active).toEqual([{ userId: second }])
    })
  })
})
