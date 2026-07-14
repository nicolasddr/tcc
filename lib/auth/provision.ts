// lib/auth/provision.ts — provisionamento do usuário no 1º login (app-layer).
//
// ⚠️ SERVER-ONLY: usa a conexão DONA (`ownerDb`). Só rode em rotas/actions do servidor.
//
// Substitui o trigger `handle_new_user` (0001/0009) + `sync_profile_email` (0002), que
// saem no flip da Fase 4 (issue #22). Chamado por `app/auth/callback/route.ts` logo após
// o `exchangeCodeForSession`. Roda como DONO (fura RLS/grants): materializa o perfil,
// vincula convites por e-mail pendentes ao novo id e emite as notificações — exatamente
// o que a função `security definer` fazia no banco.
//
// IDEMPOTENTE: coexiste com o trigger até ele ser removido no commit 19. No fluxo real o
// trigger roda no insert de `auth.users` (antes do callback) e resolve tudo; esta função
// então encontra o perfil já criado e nenhum convite pendente por vincular — no-op.
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
  // (1) Perfil: cria no 1º login (espelha handle_new_user); em logins seguintes só
  // sincroniza o e-mail (absorve sync_profile_email). NÃO sobrescreve `name` — o usuário
  // pode tê-lo editado no perfil, e handle_new_user só setava name na criação.
  await db
    .insert(profiles)
    .values({ id: user.id, name: user.name, email: user.email })
    .onConflictDoUpdate({ target: profiles.id, set: { email: user.email } })

  // (2) Vincula os convites por e-mail pendentes ao perfil recém-criado (ADR 0006).
  // Captura os resolvidos para notificar (era o gatilho de inv_notify_resolved). Match
  // case-insensitive, espelhando lower(invitee_email) = lower(new.email).
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

  // (3) Uma notificação por convite resolvido (espelha notify_on_invitation_resolved).
  for (const inv of resolved) {
    await emitInvitationNotification(db, {
      id: inv.id,
      userId: user.id,
      projectId: inv.projectId,
      invitedBy: inv.invitedBy,
    })
  }
}
