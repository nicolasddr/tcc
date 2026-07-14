// lib/authz.int.test.ts — testes de integração dos predicados de autorização
// (issue #22, Fase 0). Portam os casos de COMPORTAMENTO EXTERNO que hoje o pgTAP
// afirma sob RLS ("quem pode o quê"), agora contra as funções de `lib/authz`.
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
// Rodam sob transação-com-rollback (ver test/helpers.ts): não sujam o banco.
import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  isSuperAdmin,
  isMemberOf,
  isProjectMember,
  isProjectAdmin,
  hasPendingInvitation,
  sharesProjectWith,
  canViewResponse,
  canAnswerOnboarding,
  canCreateProjects,
  findInviteeByEmail,
} from '@/lib/authz'
import { profiles } from '@/lib/db'
import {
  inRollbackTx,
  createUser,
  createProject,
  addActiveEvaluator,
  addPendingMember,
  addPendingInvitation,
  grantCreatePermission,
  memberId,
} from '@/test/helpers'

describe('lib/authz — predicados de autorização', () => {
  it('isProjectAdmin: só o criador (admin ativo) é admin', async () => {
    await inRollbackTx(async (tx) => {
      const admin = await createUser(tx, 'Admin')
      const evaluator = await createUser(tx, 'Avaliador')
      const stranger = await createUser(tx, 'Estranho')
      const project = await createProject(tx, admin)
      await addActiveEvaluator(tx, project, evaluator)

      expect(await isProjectAdmin(admin, project, tx)).toBe(true)
      expect(await isProjectAdmin(evaluator, project, tx)).toBe(false)
      expect(await isProjectAdmin(stranger, project, tx)).toBe(false)
    })
  })

  it('isMemberOf: admin e avaliador ativo são membros; estranho não', async () => {
    await inRollbackTx(async (tx) => {
      const admin = await createUser(tx)
      const evaluator = await createUser(tx)
      const stranger = await createUser(tx)
      const project = await createProject(tx, admin)
      await addActiveEvaluator(tx, project, evaluator)

      expect(await isMemberOf(admin, project, tx)).toBe(true)
      expect(await isMemberOf(evaluator, project, tx)).toBe(true)
      expect(await isMemberOf(stranger, project, tx)).toBe(false)
    })
  })

  it('isProjectMember: pega quem ainda está em pending_onboarding (isMemberOf não)', async () => {
    await inRollbackTx(async (tx) => {
      const admin = await createUser(tx)
      const pending = await createUser(tx)
      const project = await createProject(tx, admin)
      await addPendingMember(tx, project, pending)

      expect(await isProjectMember(pending, project, tx)).toBe(true)
      expect(await isMemberOf(pending, project, tx)).toBe(false)
    })
  })

  it('hasPendingInvitation: só quem tem convite pendente', async () => {
    await inRollbackTx(async (tx) => {
      const admin = await createUser(tx)
      const invited = await createUser(tx)
      const other = await createUser(tx)
      const project = await createProject(tx, admin)
      await addPendingInvitation(tx, project, invited, admin)

      expect(await hasPendingInvitation(invited, project, tx)).toBe(true)
      expect(await hasPendingInvitation(other, project, tx)).toBe(false)
    })
  })

  it('sharesProjectWith: dois membros ativos do mesmo projeto; estranho não', async () => {
    await inRollbackTx(async (tx) => {
      const admin = await createUser(tx)
      const evaluator = await createUser(tx)
      const stranger = await createUser(tx)
      const project = await createProject(tx, admin)
      await addActiveEvaluator(tx, project, evaluator)

      expect(await sharesProjectWith(admin, evaluator, tx)).toBe(true)
      expect(await sharesProjectWith(evaluator, admin, tx)).toBe(true)
      expect(await sharesProjectWith(admin, stranger, tx)).toBe(false)
    })
  })

  it('canViewResponse: o próprio respondente e o admin veem; estranho não', async () => {
    await inRollbackTx(async (tx) => {
      const admin = await createUser(tx)
      const evaluator = await createUser(tx)
      const stranger = await createUser(tx)
      const project = await createProject(tx, admin)
      const evaluatorMember = await addActiveEvaluator(tx, project, evaluator)

      expect(await canViewResponse(evaluator, evaluatorMember, tx)).toBe(true)
      expect(await canViewResponse(admin, evaluatorMember, tx)).toBe(true)
      expect(await canViewResponse(stranger, evaluatorMember, tx)).toBe(false)
    })
  })

  it('canAnswerOnboarding: só o próprio membro em pending_onboarding', async () => {
    await inRollbackTx(async (tx) => {
      const admin = await createUser(tx)
      const pending = await createUser(tx)
      const project = await createProject(tx, admin)
      const pendingMember = await addPendingMember(tx, project, pending)
      const adminMember = await memberId(tx, project, admin)

      expect(await canAnswerOnboarding(pending, pendingMember, tx)).toBe(true)
      // admin é 'active', não 'pending_onboarding' → não responde onboarding
      expect(await canAnswerOnboarding(admin, adminMember, tx)).toBe(false)
      // outro usuário não responde pela linha alheia
      expect(await canAnswerOnboarding(admin, pendingMember, tx)).toBe(false)
    })
  })

  it('canCreateProjects: só quem tem a flag de plataforma ligada', async () => {
    await inRollbackTx(async (tx) => {
      const withPerm = await createUser(tx)
      const withoutPerm = await createUser(tx)
      await grantCreatePermission(tx, withPerm)

      expect(await canCreateProjects(withPerm, tx)).toBe(true)
      expect(await canCreateProjects(withoutPerm, tx)).toBe(false)
    })
  })

  it('isSuperAdmin: falso para um usuário comum recém-criado', async () => {
    await inRollbackTx(async (tx) => {
      const user = await createUser(tx)
      expect(await isSuperAdmin(user, tx)).toBe(false)
    })
  })

  // find_invitee_by_email reimplementada em TS (issue #22, Fase 3, commit 14).
  it('findInviteeByEmail: resolve {id,name}; anti-enumeração barra quem não pode criar projetos', async () => {
    await inRollbackTx(async (tx) => {
      const inviter = await createUser(tx, 'Convidante')
      const invitee = await createUser(tx, 'Convidado')
      const [{ email }] = await tx
        .select({ email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, invitee))

      // GUARDA ANTI-ENUMERAÇÃO: sem can_create_projects, devolve null mesmo p/ e-mail
      // que EXISTE — indistinguível de "não cadastrado". Quem não pode convidar não sonda.
      expect(await findInviteeByEmail(inviter, email, tx)).toBeNull()

      // Com a permissão ligada, resolve só id+name (nada além disso vaza).
      await grantCreatePermission(tx, inviter)
      expect(await findInviteeByEmail(inviter, email, tx)).toEqual({
        id: invitee,
        name: 'Convidado',
      })

      // Case-insensitive (espelha `lower(email)`).
      expect(await findInviteeByEmail(inviter, email.toUpperCase(), tx)).toEqual({
        id: invitee,
        name: 'Convidado',
      })

      // E-mail inexistente → null (mesmo com permissão).
      expect(await findInviteeByEmail(inviter, 'ninguem@test.local', tx)).toBeNull()
    })
  })
})
