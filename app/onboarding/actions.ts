'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import {
  transaction,
  projectMembers,
  projectInvitations,
  onboardingQuestions,
  onboardingResponses,
} from '@/lib/db'
import { hasPendingInvitation } from '@/lib/authz'
import { CONSENT_TEXT } from './consent'
import { OTHER_VALUE, coerceOptions } from './questions'
import { ANSWER_MAX } from '@/lib/limits'

export type OnboardingState = { error: string } | null

// HU-020 (Opção A, ADR-003): aceitar o convite MATERIALIZA a linha do avaliador em
// pending_onboarding e marca o convite como accepted — tudo numa única transação. Entrar
// num projeto exige um convite PENDENTE: isso é checado EXPLICITAMENTE na app
// (`hasPendingInvitation`). A ORDEM importa: o membro entra ENQUANTO o convite ainda está
// `pending`; só depois viramos o convite para `accepted`. O consentimento (promover a
// active) é o passo seguinte.
export async function acceptInvitation(formData: FormData): Promise<void> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) redirect('/dashboard')

  const joined = await transaction(async (tx) => {
    // Idempotência (re-clique / já aceitou antes): se a linha já existe, NÃO reinsere e
    // trata como sucesso (segue para o onboarding).
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
    if (existing) return true

    // Sem convite pendente, não materializa a linha. Evita que qualquer um se
    // auto-adicione a um projeto ao chamar esta action.
    if (!(await hasPendingInvitation(userId, projectId, tx))) return false

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
    return true
  })

  // redirect lança control-flow do Next — fora do transaction p/ não abortar a transação.
  // Sem convite (joined=false) não houve escrita: volta para a página do projeto.
  redirect(joined ? `/projects/${projectId}/onboarding` : `/projects/${projectId}`)
}

// HU-028/032 (US 31/32): o avaliador registra o consentimento (timestamp + snapshot do
// texto) E responde a TODAS as perguntas de onboarding (obrigatórias) — só então a linha
// é promovida a `active`. Tudo numa única transação. O escopo é EXPLÍCITO na app: a linha
// do membro é buscada por `userId` e só se prossegue se ela estiver em pending_onboarding
// (o `project_member_id` das respostas nunca vem do cliente, é derivado daqui). As
// respostas são validadas ANTES de qualquer escrita, então um onboarding incompleto não
// grava nada.
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  const consented = formData.get('consent') === 'on'
  if (!projectId) return { error: 'Projeto inválido.' }
  if (!consented) {
    return { error: 'É necessário aceitar o termo de consentimento para concluir o onboarding.' }
  }

  const now = new Date().toISOString()

  const result = await transaction(async (tx) => {
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

    // Sem linha própria em pending_onboarding (já concluiu ou nunca aceitou), não responde
    // nada — trata como concluído.
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
      if (answer.length > ANSWER_MAX) return { invalid: true, tooLong: true } as const
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
    return 'tooLong' in result
      ? { error: `Uma das respostas passa do limite de ${ANSWER_MAX} caracteres.` }
      : { error: 'Responda todas as perguntas do onboarding para concluir.' }
  }

  // Concluído (ou já estava): revalida e volta para o projeto. redirect fica FORA do
  // transaction (lança control-flow do Next → abortaria a transação).
  if ('ok' in result) revalidatePath('/dashboard')
  redirect(`/projects/${projectId}`)
}

// HU-020 (Opção A): abandonar o onboarding DELETA a linha ainda em pending_onboarding e
// REVERTE o convite para `pending`, para o avaliador poder reconsiderar depois. Ambas as
// escritas têm escopo "own" explícito (WHERE user_id/invitee_id = userId), então mexem só
// nas linhas do próprio usuário. Deletar primeiro, depois reverter.
export async function abandonOnboarding(formData: FormData): Promise<void> {
  const userId = await requireUserId()

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) redirect('/dashboard')

  await transaction(async (tx) => {
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
