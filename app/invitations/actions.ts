'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { withUser, projectInvitations } from '@/lib/db'

// HU-019: o convidado recusa um convite pendente (status → declined). O UPDATE passa
// por `withUser` (papel `authenticated`), então a RLS (inv_update) e o grant por
// coluna (status, resolved_at) continuam garantindo que só o próprio convidado (ou o
// admin) muda a linha; o filtro por invitee_id é defesa em profundidade. Aceitar o
// convite é a fatia 04.
export async function declineInvitation(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const invitationId = String(formData.get('invitation_id') ?? '')
  if (!invitationId) return

  await withUser(userId, (tx) =>
    tx
      .update(projectInvitations)
      .set({ status: 'declined', resolvedAt: new Date().toISOString() })
      .where(
        and(
          eq(projectInvitations.id, invitationId),
          eq(projectInvitations.inviteeId, userId),
          eq(projectInvitations.status, 'pending'),
        ),
      ),
  )

  revalidatePath('/dashboard')
}
