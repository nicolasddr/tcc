import Link from '@/app/components/app-link'
import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { withUser, projects, projectMembers, onboardingQuestions } from '@/lib/db'
import { CONSENT_TEXT } from '@/app/onboarding/consent'
import { coerceOptions, type OnboardingQuestion } from '@/app/onboarding/questions'
import { ConsentForm } from './consent-form'
import '../../projects.css'
import '@/app/notifications/notifications.css'

// HU-028: passo de consentimento do onboarding do avaliador. Só faz sentido quando o
// usuário tem uma linha de avaliador em pending_onboarding (aceitou o convite mas ainda
// não consentiu). O acesso é gated EXPLICITAMENTE na app pela própria linha de membership
// (buscada por userId): se já está active (concluiu) ou não tem linha (não aceitou), volta
// para a página do projeto. As perguntas (oq_select: is_project_member) só são exibidas ao
// membro pendente. A RLS segue como backstop.
export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const { project, membership, questions } = await withUser(userId, async (tx) => {
    const [project] = await tx
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    const [membership] = await tx
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, id),
          eq(projectMembers.userId, userId),
          eq(projectMembers.role, 'evaluator'),
        ),
      )
      .limit(1)

    // As perguntas do projeto (oq_select: is_project_member — a linha pendente já conta).
    const questionRows = await tx
      .select({
        id: onboardingQuestions.id,
        questionText: onboardingQuestions.questionText,
        questionType: onboardingQuestions.questionType,
        options: onboardingQuestions.options,
      })
      .from(onboardingQuestions)
      .where(eq(onboardingQuestions.projectId, id))
      .orderBy(onboardingQuestions.orderIndex)

    const questions = questionRows.map<OnboardingQuestion>((q) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType === 'multiple_choice' ? 'multiple_choice' : 'open',
      options: coerceOptions(q.options),
    }))

    return { project, membership, questions }
  })

  if (!project) notFound()
  if (!membership || membership.status !== 'pending_onboarding') {
    redirect(`/projects/${id}`)
  }

  return (
    <div className="project-page">
      <header className="project-topbar">
        <Link href={`/projects/${id}`} className="project-back">
          ← Voltar
        </Link>
      </header>

      <main className="project-main">
        <div className="project-narrow">
          <h1 className="project-page-title">Onboarding — {project.name}</h1>
          <p className="project-page-subtitle">
            Antes de participar como avaliador, leia e aceite o termo de consentimento
            {questions.length > 0 ? ' e responda às perguntas abaixo' : ''}.
          </p>
          <ConsentForm projectId={id} consentText={CONSENT_TEXT} questions={questions} />
        </div>
      </main>
    </div>
  )
}
