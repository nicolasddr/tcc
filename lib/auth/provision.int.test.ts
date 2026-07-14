// lib/auth/provision.int.test.ts — testes de integração do provisionamento no 1º
// login (issue #22, Fase 4, commit 17). Cobre o COMPORTAMENTO que substitui os
// triggers handle_new_user + sync_profile_email + notify_on_invitation_resolved:
// criação de perfil, sincronização de e-mail, vínculo de convite por e-mail e
// notificação — a rede que passa a ser load-bearing quando os triggers saírem (c19).
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`). Rodam sob transação-com-
// rollback (test/helpers.ts): não sujam o banco.
//
// GOTCHA da coexistência: nos commits 17-18 os triggers AINDA existem. O trigger
// inv_notify_resolved pega carona no nosso UPDATE de invitee_id e emitiria uma 2ª
// notificação idêntica — no fluxo real isso não acontece (o trigger handle_new_user
// vence a corrida, resolve tudo no insert de auth.users, e nossa função vira no-op).
// Para medir SÓ o efeito da nossa função (e escrever a asserção que continuará valendo
// pós-flip), desligamos os triggers na transação de teste com
// `set local session_replication_role = replica` — simula o mundo sem triggers.
import { describe, it, expect } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { provisionUserOnFirstLogin } from '@/lib/auth/provision'
import { profiles, projectInvitations, notifications } from '@/lib/db'
import type { Transaction } from '@/lib/db'
import {
  inRollbackTx,
  createUser,
  createProject,
  grantCreatePermission,
} from '@/test/helpers'

// Insere um convite PENDENTE por e-mail (invitee_id NULL, resolvido no 1º login).
async function addEmailInvitation(
  tx: Transaction,
  projectId: string,
  inviteeEmail: string,
  invitedBy: string,
): Promise<string> {
  const [row] = await tx
    .insert(projectInvitations)
    .values({ projectId, inviteeEmail, invitedBy, status: 'pending' })
    .returning({ id: projectInvitations.id })
  return row.id
}

// Desliga os triggers para o resto da transação: mede o efeito puro da app-layer,
// como será pós-flip (commit 19 remove os triggers de fato).
async function suppressTriggers(tx: Transaction): Promise<void> {
  await tx.execute(sql`set local session_replication_role = replica`)
}

describe('provisionUserOnFirstLogin', () => {
  it('cria o perfil no 1º login (nome e e-mail do provedor)', async () => {
    await inRollbackTx(async (tx) => {
      // Materializa auth.users (o trigger cria o perfil) e o remove para simular o
      // 1º login sem perfil — o cenário que a nossa função cobre pós-flip.
      const id = await createUser(tx, 'Nome Antigo', 'novo@exemplo.test')
      await tx.delete(profiles).where(eq(profiles.id, id))
      await suppressTriggers(tx)

      await provisionUserOnFirstLogin({ id, email: 'novo@exemplo.test', name: 'Fulana' }, tx)

      const [p] = await tx
        .select({ name: profiles.name, email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, id))
      expect(p).toEqual({ name: 'Fulana', email: 'novo@exemplo.test' })
    })
  })

  it('em login seguinte sincroniza o e-mail e preserva o nome editado', async () => {
    await inRollbackTx(async (tx) => {
      const id = await createUser(tx, 'Nome Original', 'antigo@exemplo.test')
      // Usuário editou o nome no perfil depois da criação.
      await tx.update(profiles).set({ name: 'Nome Editado' }).where(eq(profiles.id, id))
      await suppressTriggers(tx)

      // Novo login com e-mail atualizado no provedor.
      await provisionUserOnFirstLogin({ id, email: 'atualizado@exemplo.test', name: 'Ignorado' }, tx)

      const [p] = await tx
        .select({ name: profiles.name, email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, id))
      expect(p).toEqual({ name: 'Nome Editado', email: 'atualizado@exemplo.test' })
    })
  })

  it('vincula convite por e-mail pendente e emite UMA notificação', async () => {
    await inRollbackTx(async (tx) => {
      const inviter = await createUser(tx, 'Convidante')
      await grantCreatePermission(tx, inviter)
      const project = await createProject(tx, inviter, 'Projeto Alfa')
      const email = 'convidada@exemplo.test'
      const newUser = await createUser(tx, 'Convidada', email)
      const invitationId = await addEmailInvitation(tx, project, email, inviter)
      await suppressTriggers(tx)

      await provisionUserOnFirstLogin({ id: newUser, email, name: 'Convidada' }, tx)

      // Convite vinculado ao novo id.
      const [inv] = await tx
        .select({ inviteeId: projectInvitations.inviteeId })
        .from(projectInvitations)
        .where(eq(projectInvitations.id, invitationId))
      expect(inv.inviteeId).toBe(newUser)

      // Exatamente uma notificação, com payload denormalizado.
      const notes = await tx
        .select({ type: notifications.type, payload: notifications.payload })
        .from(notifications)
        .where(eq(notifications.userId, newUser))
      expect(notes).toHaveLength(1)
      expect(notes[0].type).toBe('project_invitation')
      expect(notes[0].payload).toMatchObject({
        invitation_id: invitationId,
        project_id: project,
        project_name: 'Projeto Alfa',
        invited_by: inviter,
        inviter_name: 'Convidante',
      })
    })
  })

  it('casa o e-mail do convite de forma case-insensitive', async () => {
    await inRollbackTx(async (tx) => {
      const inviter = await createUser(tx, 'Convidante')
      const project = await createProject(tx, inviter)
      const newUser = await createUser(tx, 'Convidada', 'pessoa@exemplo.test')
      const invitationId = await addEmailInvitation(tx, project, 'Pessoa@Exemplo.TEST', inviter)
      await suppressTriggers(tx)

      await provisionUserOnFirstLogin({ id: newUser, email: 'pessoa@exemplo.test', name: 'Convidada' }, tx)

      const [inv] = await tx
        .select({ inviteeId: projectInvitations.inviteeId })
        .from(projectInvitations)
        .where(eq(projectInvitations.id, invitationId))
      expect(inv.inviteeId).toBe(newUser)
    })
  })

  it('é idempotente: uma 2ª chamada não re-vincula nem duplica notificação', async () => {
    await inRollbackTx(async (tx) => {
      const inviter = await createUser(tx, 'Convidante')
      const project = await createProject(tx, inviter)
      const email = 'repetida@exemplo.test'
      const newUser = await createUser(tx, 'Convidada', email)
      await addEmailInvitation(tx, project, email, inviter)
      await suppressTriggers(tx)

      await provisionUserOnFirstLogin({ id: newUser, email, name: 'Convidada' }, tx)
      await provisionUserOnFirstLogin({ id: newUser, email, name: 'Convidada' }, tx)

      const notes = await tx
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.userId, newUser))
      expect(notes).toHaveLength(1)
    })
  })

  it('não notifica quando não há convite pendente para o e-mail', async () => {
    await inRollbackTx(async (tx) => {
      const id = await createUser(tx, 'Sozinho', 'sozinho@exemplo.test')
      await suppressTriggers(tx)

      await provisionUserOnFirstLogin({ id, email: 'sozinho@exemplo.test', name: 'Sozinho' }, tx)

      const notes = await tx
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.userId, id))
      expect(notes).toHaveLength(0)
    })
  })
})
