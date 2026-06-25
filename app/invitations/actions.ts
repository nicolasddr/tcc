'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// HU-019: o convidado recusa um convite pendente (status → declined). A RLS
// (inv_update) e o grant por coluna (status, resolved_at) garantem que só o próprio
// convidado (ou o admin) muda a linha; o filtro por invitee_id é defesa em
// profundidade. Aceitar o convite é a fatia 04.
export async function declineInvitation(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const invitationId = String(formData.get('invitation_id') ?? '')
  if (!invitationId) return

  await supabase
    .from('project_invitations')
    .update({ status: 'declined', resolved_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('invitee_id', user.id)
    .eq('status', 'pending')

  revalidatePath('/dashboard')
}
