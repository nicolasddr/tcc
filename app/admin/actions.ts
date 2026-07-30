'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { transaction, platformPermissionRequests, profiles } from '@/lib/db'
import { isSuperAdmin } from '@/lib/authz'
import { emitPermissionDecisionNotification } from '@/lib/notifications/permission'

// Fatia 08 (#33): o super-admin decide uma solicitação de permissão de criar projetos.
// A permissão é checada EXPLICITAMENTE na app (`isSuperAdmin`) ANTES de qualquer escrita —
// sem super-admin, a action é um no-op silencioso (mesmo padrão de setProjectStatus/
// removeMember). Toda a decisão roda numa única transação:
//   • a linha da solicitação vira 'approved'/'rejected' com `resolved_by`/`resolved_at`,
//     mas SÓ enquanto ainda está 'pending' (o `where status='pending'` torna a decisão
//     idempotente e imune à corrida: dois cliques ou dois admins não decidem duas vezes);
//   • ao aprovar, liga a flag `can_create_projects` no perfil do solicitante;
//   • emite a notificação in-platform da decisão para o solicitante.
// O `returning({ userId })` diz a quem pertence a solicitação (destinatário da notificação).
async function resolvePermissionRequest(
  formData: FormData,
  decision: 'approved' | 'rejected',
): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const adminId = claims.sub

  const requestId = String(formData.get('request_id') ?? '')
  if (!requestId) return

  if (!(await isSuperAdmin(adminId))) return

  await transaction(async (tx) => {
    const resolved = await tx
      .update(platformPermissionRequests)
      .set({
        status: decision,
        resolvedBy: adminId,
        resolvedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(platformPermissionRequests.id, requestId),
          eq(platformPermissionRequests.status, 'pending'),
        ),
      )
      .returning({ userId: platformPermissionRequests.userId })

    // Casou 0 linhas: já foi decidida (ou id inválido) — nada a fazer.
    if (resolved.length === 0) return
    const requesterId = resolved[0].userId

    if (decision === 'approved') {
      await tx
        .update(profiles)
        .set({ canCreateProjects: true })
        .where(eq(profiles.id, requesterId))
    }

    await emitPermissionDecisionNotification(tx, requesterId, decision)
  })

  revalidatePath('/admin/permissions')
  revalidatePath('/dashboard')
}

export async function approvePermissionRequest(formData: FormData): Promise<void> {
  await resolvePermissionRequest(formData, 'approved')
}

export async function rejectPermissionRequest(formData: FormData): Promise<void> {
  await resolvePermissionRequest(formData, 'rejected')
}
