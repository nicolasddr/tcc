// lib/notifications/invitation.ts — emissão da notificação in-platform de convite.
//
// ⚠️ SERVER-ONLY. Fonte única do payload denormalizado de 'project_invitation',
// consumido por app/notifications/labels.ts (chaves snake_case). Substitui os triggers
// notify_on_invitation (convite a quem já tem conta) e notify_on_invitation_resolved
// (convite por e-mail resolvido no 1º login) — ambos saem no flip da Fase 4 (issue #22).
import { eq } from 'drizzle-orm'
import { type DbExecutor, projects, profiles, notifications } from '@/lib/db'

export type InvitationNotice = {
  /** id do convite (project_invitations.id). */
  id: string
  /** destinatário da notificação (o convidado, já com perfil). */
  userId: string
  projectId: string
  /** quem convidou; nullable (FK set null). */
  invitedBy: string | null
}

/**
 * Insere UMA notificação de convite para `inv.userId`, denormalizando nome do projeto e
 * de quem convidou (como os triggers faziam). Roda como DONO — notifications não tem
 * grant/policy de INSERT para o papel `authenticated`.
 */
export async function emitInvitationNotification(
  db: DbExecutor,
  inv: InvitationNotice,
): Promise<void> {
  const [proj] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, inv.projectId))
    .limit(1)

  let inviterName: string | null = null
  if (inv.invitedBy) {
    const [row] = await db
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, inv.invitedBy))
      .limit(1)
    inviterName = row?.name ?? null
  }

  await db.insert(notifications).values({
    userId: inv.userId,
    type: 'project_invitation',
    payload: {
      invitation_id: inv.id,
      project_id: inv.projectId,
      project_name: proj?.name ?? null,
      invited_by: inv.invitedBy,
      inviter_name: inviterName,
    },
  })
}
