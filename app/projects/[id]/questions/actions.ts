'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { withUser, onboardingQuestions } from '@/lib/db'
import { parseOptionsInput, type OnboardingQuestionType } from '@/app/onboarding/questions'

// `nonce` muda a cada sucesso: o form de adicionar o usa como `key` para remontar os
// campos (limpar) sem precisar de um efeito que chame setState.
export type QuestionState = { error: string } | { ok: true; nonce: number } | null

const QUESTION_TYPES: readonly string[] = ['open', 'multiple_choice']

// Valida/normaliza os campos comuns do formulário de pergunta (adicionar e editar).
// Devolve os dados prontos para persistir, ou uma mensagem de erro amigável. A RLS
// (oq_insert/oq_update, is_project_admin) é o gate de verdade; isto é só usabilidade.
function parseQuestionForm(
  formData: FormData,
):
  | { error: string }
  | { text: string; type: OnboardingQuestionType; options: string[] | null } {
  const text = String(formData.get('question_text') ?? '').trim()
  const typeRaw = String(formData.get('question_type') ?? '')

  if (!text) return { error: 'Informe o texto da pergunta.' }
  if (!QUESTION_TYPES.includes(typeRaw)) return { error: 'Tipo de pergunta inválido.' }

  const type = typeRaw as OnboardingQuestionType
  let options: string[] | null = null
  if (type === 'multiple_choice') {
    options = parseOptionsInput(String(formData.get('options') ?? ''))
    if (options.length < 2) {
      return { error: 'Uma pergunta de múltipla escolha precisa de pelo menos 2 opções.' }
    }
  }
  return { text, type, options }
}

// HU-026 (US 29): o administrador define uma pergunta de onboarding (aberta ou de
// múltipla escolha com "Outro"). INSERT via Drizzle sob `withUser`; a RLS oq_insert
// exige is_project_admin. O order_index é o próximo na sequência do projeto (sem
// unique — inserções concorrentes só podem empatar a ordem, nunca falhar).
export async function addQuestion(
  _prev: QuestionState,
  formData: FormData,
): Promise<QuestionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = String(formData.get('project_id') ?? '')
  if (!projectId) return { error: 'Projeto inválido.' }

  const parsed = parseQuestionForm(formData)
  if ('error' in parsed) return parsed

  try {
    await withUser(user.id, async (tx) => {
      const [last] = await tx
        .select({ orderIndex: onboardingQuestions.orderIndex })
        .from(onboardingQuestions)
        .where(eq(onboardingQuestions.projectId, projectId))
        .orderBy(desc(onboardingQuestions.orderIndex))
        .limit(1)
      const nextOrder = last ? last.orderIndex + 1 : 0

      await tx.insert(onboardingQuestions).values({
        projectId,
        questionText: parsed.text,
        questionType: parsed.type,
        options: parsed.options,
        orderIndex: nextOrder,
      })
    })
  } catch {
    return {
      error:
        'Não foi possível adicionar a pergunta. Apenas o administrador do projeto pode defini-las.',
    }
  }

  revalidatePath(`/projects/${projectId}/questions`)
  return { ok: true, nonce: Date.now() }
}

// HU-027 (US 30): editar mantém as respostas — só atualiza o texto/tipo/opções da
// pergunta; onboarding_responses não é tocado (as respostas antigas passam a ser
// exibidas com o texto novo). A RLS oq_update exige is_project_admin.
export async function updateQuestion(
  _prev: QuestionState,
  formData: FormData,
): Promise<QuestionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = String(formData.get('project_id') ?? '')
  const questionId = String(formData.get('question_id') ?? '')
  if (!projectId || !questionId) return { error: 'Pergunta inválida.' }

  const parsed = parseQuestionForm(formData)
  if ('error' in parsed) return parsed

  try {
    await withUser(user.id, (tx) =>
      tx
        .update(onboardingQuestions)
        .set({
          questionText: parsed.text,
          questionType: parsed.type,
          options: parsed.options,
        })
        .where(
          and(
            eq(onboardingQuestions.id, questionId),
            eq(onboardingQuestions.projectId, projectId),
          ),
        ),
    )
  } catch {
    return { error: 'Não foi possível atualizar a pergunta.' }
  }

  revalidatePath(`/projects/${projectId}/questions`)
  return { ok: true, nonce: Date.now() }
}

// HU-027 (US 30): remover cascateia as respostas daquela pergunta (FK
// onboarding_responses.question_id ON DELETE CASCADE). A RLS oq_delete exige
// is_project_admin. Ação simples (sem estado): o form client confirma antes de enviar.
export async function removeQuestion(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = String(formData.get('project_id') ?? '')
  const questionId = String(formData.get('question_id') ?? '')
  if (!projectId || !questionId) return

  await withUser(user.id, (tx) =>
    tx
      .delete(onboardingQuestions)
      .where(
        and(
          eq(onboardingQuestions.id, questionId),
          eq(onboardingQuestions.projectId, projectId),
        ),
      ),
  )

  revalidatePath(`/projects/${projectId}/questions`)
}
