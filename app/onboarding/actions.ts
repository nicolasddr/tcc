'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import {
  withUser,
  projectMembers,
  projectInvitations,
  onboardingQuestions,
  onboardingResponses,
} from '@/lib/db'
import { CONSENT_TEXT } from './consent'
import { OTHER_VALUE, coerceOptions } from './questions'

export type OnboardingState = { error: string } | null

// HU-020 (Opção A, ADR-003): aceitar o convite MATERIALIZA a linha do avaliador em
// pending_onboarding e marca o convite como accepted — tudo numa transação `withUser`
// (papel `authenticated`, RLS ativa). A ORDEM importa: o membro entra ENQUANTO o
// convite ainda está `pending`, porque a policy pm_insert exige has_pending_invitation;
// só depois viramos o convite para `accepted`. O consentimento (promover a active) é o
// passo seguinte, na página de onboarding.
export async function acceptInvitation(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) redirect('/dashboard')

  await withUser(userId, async (tx) => {
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
          eq(projectMembers.userId, userId),
          eq(projectMembers.role, 'evaluator'),
        ),
      )
      .limit(1)
    if (existing) return

    await tx.insert(projectMembers).values({
      projectId,
      userId: userId,
      role: 'evaluator',
      status: 'pending_onboarding',
    })

    await tx
      .update(projectInvitations)
      .set({ status: 'accepted', resolvedAt: new Date().toISOString() })
      .where(
        and(
          eq(projectInvitations.projectId, projectId),
          eq(projectInvitations.inviteeId, userId),
          eq(projectInvitations.status, 'pending'),
        ),
      )
  })

  // redirect lança control-flow do Next — fora do withUser p/ não abortar a transação.
  redirect(`/projects/${projectId}/onboarding`)
}

// HU-028/032 (US 31/32): o avaliador registra o consentimento (timestamp + snapshot do
// texto) E responde a TODAS as perguntas de onboarding (obrigatórias) — só então a linha
// é promovida a `active`. Tudo numa transação `withUser`: as respostas entram ENQUANTO a
// linha ainda é pending_onboarding (a RLS or_insert / can_answer_onboarding exige isso),
// e só depois o status vira active. As respostas são validadas ANTES de qualquer escrita,
// então um onboarding incompleto não grava nada. Os CHECKs pm_consent_required /
// pm_onboarding_done do banco garantem consentimento + onboarding registrados no active.
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  const consented = formData.get('consent') === 'on'
  if (!projectId) return { error: 'Projeto inválido.' }
  if (!consented) {
    return { error: 'É necessário aceitar o termo de consentimento para concluir o onboarding.' }
  }

  const now = new Date().toISOString()

  const result = await withUser(userId, async (tx) => {
    const [member] = await tx
      .select({ id: projectMembers.id, status: projectMembers.status })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
          eq(projectMembers.role, 'evaluator'),
        ),
      )
      .limit(1)

    // Sem linha pendente (já concluiu ou nunca aceitou): trata como concluído.
    if (!member || member.status !== 'pending_onboarding') return { done: true } as const

    const questions = await tx
      .select({
        id: onboardingQuestions.id,
        questionType: onboardingQuestions.questionType,
        options: onboardingQuestions.options,
      })
      .from(onboardingQuestions)
      .where(eq(onboardingQuestions.projectId, projectId))
      .orderBy(onboardingQuestions.orderIndex)

    // Monta e valida as respostas ANTES de escrever (todas são obrigatórias). Na múltipla
    // escolha: ou uma das opções cadastradas, ou "Outro" + texto livre (modelo Google Forms).
    const answers: { projectMemberId: string; questionId: string; answer: string }[] = []
    for (const q of questions) {
      const raw = String(formData.get(`q_${q.id}`) ?? '').trim()
      let answer = raw
      if (q.questionType === 'multiple_choice') {
        const options = coerceOptions(q.options) ?? []
        if (raw === OTHER_VALUE) {
          answer = String(formData.get(`q_${q.id}__other`) ?? '').trim()
        } else if (!options.includes(raw)) {
          answer = '' // opção vazia ou inválida → força a falha de obrigatoriedade
        }
      }
      if (!answer) return { invalid: true } as const
      answers.push({ projectMemberId: member.id, questionId: q.id, answer })
    }

    if (answers.length > 0) {
      await tx.insert(onboardingResponses).values(answers)
    }
    await tx
      .update(projectMembers)
      .set({
        status: 'active',
        consentAcceptedAt: now,
        consentTextSnapshot: CONSENT_TEXT,
        onboardingCompletedAt: now,
      })
      .where(
        and(
          eq(projectMembers.id, member.id),
          eq(projectMembers.status, 'pending_onboarding'),
        ),
      )
    return { ok: true } as const
  })

  if ('invalid' in result) {
    return { error: 'Responda todas as perguntas do onboarding para concluir.' }
  }

  // Concluído (ou já estava): revalida e volta para o projeto. redirect fica FORA do
  // withUser (lança control-flow do Next → abortaria a transação).
  if ('ok' in result) revalidatePath('/dashboard')
  redirect(`/projects/${projectId}`)
}

// HU-020 (Opção A): abandonar o onboarding DELETA a linha ainda em pending_onboarding
// (policy pm_delete_own_pending + grant de DELETE, migration 0007) e REVERTE o convite
// para `pending`, para o avaliador poder reconsiderar depois. Deletar primeiro, depois
// reverter: nenhum passo depende do outro, mas mantém a ordem espelho do aceite.
export async function abandonOnboarding(formData: FormData): Promise<void> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) redirect('/dashboard')

  await withUser(userId, async (tx) => {
    await tx
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
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
          eq(projectInvitations.inviteeId, userId),
          eq(projectInvitations.status, 'accepted'),
        ),
      )
  })

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
