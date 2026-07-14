// app/projects/actions.int.test.ts — testes de integração das Server Actions de
// projetos (issue #22, Fase 1, commit 4). Portam os casos de COMPORTAMENTO EXTERNO
// que o pgTAP afirma sob RLS (02_create_list, 08_project_lifecycle, 09_remove_leave,
// 07_invitation_by_email), agora provando a checagem de autorização EXPLÍCITA que as
// actions passam a fazer na app — com a RLS ainda ligada como backstop.
//
// Diferente de `lib/authz.int.test.ts`, aqui NÃO dá para usar `inRollbackTx`: cada
// action abre a própria transação (`withUser`) e COMMITA. Então as fixtures são
// gravadas via `ownerDb` e removidas por `cleanup()` no fim de cada teste.
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'

// Estado do "usuário logado" que o mock de getClaims lê. `vi.hoisted` garante que
// existe antes do factory do mock (que o vitest içar acima dos imports).
const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', () => ({
  getClaims: async () => (auth.userId ? { sub: auth.userId } : null),
}))
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
  inviteEvaluator,
} from '@/app/projects/actions'
import { ownerDb, projects, projectMembers, projectInvitations } from '@/lib/db'
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

describe('app/projects/actions — autorização explícita (RLS como backstop)', () => {
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

    // O trigger auto_add_creator_as_admin materializa o criador como admin ativo.
    const [member] = await ownerDb
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, newId),
          eq(projectMembers.userId, admin),
          eq(projectMembers.role, 'administrator'),
        ),
      )
    expect(member?.status).toBe('active')
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
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, project))
    expect(before.name).toBe('Projeto de Teste')

    auth.userId = admin
    expect(await updateProject(null, fd({ project_id: project, name: 'Editado' }))).toEqual({
      ok: expect.any(String),
    })
    const [after] = await ownerDb
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, project))
    expect(after.name).toBe('Editado')
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
    // Convite ANTES de virar membro ativo (check_invitation_target barra convidar ativo).
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
})
