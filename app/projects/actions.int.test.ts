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
  removeMember,
  leaveProject,
  inviteEvaluator,
} from '@/app/projects/actions'
import {
  ownerDb,
  profiles,
  projects,
  projectMembers,
  projectInvitations,
  notifications,
} from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingInvitation,
  grantCreatePermission,
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

  it('removeMember: não-admin → no-op; admin → inativa e cancela convite pendente', async () => {
    const admin = await newUser()
    const evaluator = await newUser()
    const outsider = await newUser()
    const project = await newProject(admin)
    // Convite ANTES de virar membro ativo (não se convida quem já é membro ativo).
    await addPendingInvitation(ownerDb, project, evaluator, admin)
    const memberRow = await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = outsider
    await removeMember(fd({ project_id: project, member_user_id: evaluator }))
    const [untouched] = await ownerDb
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(eq(projectMembers.id, memberRow))
    expect(untouched.status).toBe('active')

    auth.userId = admin
    await removeMember(fd({ project_id: project, member_user_id: evaluator }))
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

  // findInviteeByEmail (guarda anti-enumeração) flui pela action.
  it('inviteEvaluator: resolve invitee só quando o admin pode criar projetos (anti-enumeração)', async () => {
    const admin = await newUser('Admin')
    const invitee = await newUser('Convidado')
    const project = await newProject(admin)
    const [{ email }] = await ownerDb
      .select({ email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, invitee))

    // Admin SEM can_create_projects: findInviteeByEmail devolve null mesmo p/ e-mail que
    // existe → o convite cai no ramo "sem conta" (invitee_id NULL), sem vazar que há perfil.
    auth.userId = admin
    const asStranger = await inviteEvaluator(null, fd({ project_id: project, email }))
    expect(asStranger).toEqual({ ok: expect.stringContaining('ao entrar com o Google') })
    const [unresolved] = await ownerDb
      .select({ inviteeId: projectInvitations.inviteeId })
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project))
    expect(unresolved.inviteeId).toBeNull()

    // Com a permissão ligada, um novo convite (outro projeto) resolve o invitee_id e o
    // sucesso traz o NOME do convidado.
    await grantCreatePermission(ownerDb, admin)
    const project2 = await newProject(admin)
    const asInviter = await inviteEvaluator(null, fd({ project_id: project2, email }))
    expect(asInviter).toEqual({ ok: expect.stringContaining('Convidado') })
    const [resolved] = await ownerDb
      .select({ id: projectInvitations.id, inviteeId: projectInvitations.inviteeId })
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project2))
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
      project_id: project2,
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
    // find_invitee_by_email só resolve o perfil se QUEM convida tem can_create_projects
    // (guarda anti-enumeração da RPC); sem isso o convite cairia no ramo "sem conta".
    await grantCreatePermission(ownerDb, admin)
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
})
