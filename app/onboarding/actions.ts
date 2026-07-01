'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { withUser, projectMembers, projectInvitations } from '@/lib/db'
import { CONSENT_TEXT } from './consent'

export type OnboardingState = { error: string } | null

// HU-020 (Opção A, ADR-003): aceitar o convite MATERIALIZA a linha do avaliador em
// pending_onboarding e marca o convite como accepted — tudo numa transação `withUser`
// (papel `authenticated`, RLS ativa). A ORDEM importa: o membro entra ENQUANTO o
// convite ainda está `pending`, porque a policy pm_insert exige has_pending_invitation;
// só depois viramos o convite para `accepted`. O consentimento (promover a active) é o
// passo seguinte, na página de onboarding.
export async function acceptInvitation(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) redirect('/dashboard')

  await withUser(user.id, async (tx) => {
    // Idempotência (re-clique / já aceitou antes): se a linha já existe, NÃO reinsere.
    // Reinserir falharia na RLS pm_insert — que exige convite PENDENTE — pois o aceite
    // anterior já virou o convite para accepted. onConflictDoNothing NÃO cobriria isso:
    // o WITH CHECK da RLS é avaliado ANTES do ON CONFLICT, então o 42501 estoura mesmo
    // com o ON CONFLICT presente.
    const [existing] = await tx
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id),
          eq(projectMembers.role, 'evaluator'),
        ),
      )
      .limit(1)
    if (existing) return

    await tx.insert(projectMembers).values({
      projectId,
      userId: user.id,
      role: 'evaluator',
      status: 'pending_onboarding',
    })

    await tx
      .update(projectInvitations)
      .set({ status: 'accepted', resolvedAt: new Date().toISOString() })
      .where(
        and(
          eq(projectInvitations.projectId, projectId),
          eq(projectInvitations.inviteeId, user.id),
          eq(projectInvitations.status, 'pending'),
        ),
      )
  })

  // redirect lança control-flow do Next — fora do withUser p/ não abortar a transação.
  redirect(`/projects/${projectId}/onboarding`)
}

// HU-028: o avaliador registra o consentimento (timestamp + snapshot do texto) e a
// linha é promovida a `active`. A RLS (pm_update, própria linha) e o grant por coluna
// (status, consent_accepted_at, consent_text_snapshot, onboarding_completed_at) valem
// sob `authenticated`; os CHECKs pm_consent_required / pm_onboarding_done do banco
// garantem que um avaliador só fica active com consentimento + onboarding registrados.
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = String(formData.get('project_id') ?? '')
  const consented = formData.get('consent') === 'on'
  if (!projectId) return { error: 'Projeto inválido.' }
  if (!consented) {
    return { error: 'É necessário aceitar o termo de consentimento para concluir o onboarding.' }
  }

  const now = new Date().toISOString()
  const promoted = await withUser(user.id, (tx) =>
    tx
      .update(projectMembers)
      .set({
        status: 'active',
        consentAcceptedAt: now,
        consentTextSnapshot: CONSENT_TEXT,
        onboardingCompletedAt: now,
      })
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id),
          eq(projectMembers.role, 'evaluator'),
          eq(projectMembers.status, 'pending_onboarding'),
        ),
      )
      .returning({ id: projectMembers.id }),
  )

  // Se nada foi promovido (já ativo ou linha inexistente), trata como concluído.
  if (promoted.length > 0) revalidatePath('/dashboard')
  redirect(`/projects/${projectId}`)
}

// HU-020 (Opção A): abandonar o onboarding DELETA a linha ainda em pending_onboarding
// (policy pm_delete_own_pending + grant de DELETE, migration 0007) e REVERTE o convite
// para `pending`, para o avaliador poder reconsiderar depois. Deletar primeiro, depois
// reverter: nenhum passo depende do outro, mas mantém a ordem espelho do aceite.
export async function abandonOnboarding(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) redirect('/dashboard')

  await withUser(user.id, async (tx) => {
    await tx
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id),
          eq(projectMembers.role, 'evaluator'),
          eq(projectMembers.status, 'pending_onboarding'),
        ),
      )

    await tx
      .update(projectInvitations)
      .set({ status: 'pending', resolvedAt: null })
      .where(
        and(
          eq(projectInvitations.projectId, projectId),
          eq(projectInvitations.inviteeId, user.id),
          eq(projectInvitations.status, 'accepted'),
        ),
      )
  })

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
