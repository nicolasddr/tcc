// lib/auth/provision.ts — provisionamento do usuário no 1º login (app-layer).
//
// ⚠️ SERVER-ONLY: usa a conexão `ownerDb`. Só rode em rotas/actions do servidor.
//
// Provisiona o usuário no 1º login (antes vivia no trigger `handle_new_user`, removido no
// flip). Chamado por `app/auth/callback/route.ts` logo após o `exchangeCodeForSession`:
// materializa o perfil, vincula convites por e-mail pendentes ao novo id e emite as
// notificações correspondentes.
//
// IDEMPOTENTE: em logins subsequentes encontra o perfil já criado e nenhum convite
// pendente por vincular — no-op.
import { and, eq, isNull, sql } from 'drizzle-orm'
import { ownerDb, type DbExecutor, profiles, projectInvitations } from '@/lib/db'
import { emitInvitationNotification } from '@/lib/notifications/invitation'

export type NewUser = {
  id: string
  email: string
  name: string
}

/**
 * Provisiona `user` no 1º login: cria o perfil, vincula convites por e-mail pendentes e
 * notifica. Idempotente. Para atomicidade, o callback passa uma transação (`tx`); os
 * testes passam a `tx` do `inRollbackTx`. Sem argumento, roda direto no `ownerDb`.
 */
export async function provisionUserOnFirstLogin(
  user: NewUser,
  db: DbExecutor = ownerDb,
): Promise<void> {
  // (1) Perfil: cria no 1º login; em logins seguintes só sincroniza o e-mail. NÃO
  // sobrescreve `name` — o usuário pode tê-lo editado no perfil, então só o setamos na
  // criação.
  await db
    .insert(profiles)
    .values({ id: user.id, name: user.name, email: user.email })
    .onConflictDoUpdate({ target: profiles.id, set: { email: user.email } })

  // (2) Vincula os convites por e-mail pendentes ao perfil recém-criado (ADR 0006).
  // Captura os resolvidos para notificar. Match case-insensitive
  // (`lower(invitee_email) = lower(email)`).
  const resolved = await db
    .update(projectInvitations)
    .set({ inviteeId: user.id })
    .where(
      and(
        isNull(projectInvitations.inviteeId),
        eq(projectInvitations.status, 'pending'),
        sql`lower(${projectInvitations.inviteeEmail}) = lower(${user.email})`,
      ),
    )
    .returning({
      id: projectInvitations.id,
      projectId: projectInvitations.projectId,
      invitedBy: projectInvitations.invitedBy,
    })

  if (resolved.length === 0) return

  // (3) Uma notificação por convite resolvido.
  for (const inv of resolved) {
    await emitInvitationNotification(db, {
      id: inv.id,
      userId: user.id,
      projectId: inv.projectId,
      invitedBy: inv.invitedBy,
    })
  }
}
