import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers, onboardingQuestions } from '@/lib/db'
import { coerceOptions, type OnboardingQuestion } from '@/app/onboarding/questions'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'
import { QuestionManager } from './question-manager'

// HU-026/027 (US 29/30): o Administrador define/edita/remove as perguntas de onboarding
// do projeto. Só o admin ativo entra aqui — a checagem é explícita na app (`isAdmin`
// derivado das memberships do usuário); quem não é admin volta para a página do projeto.
export default async function QuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { project, isAdmin, questions } = await transaction(async (tx) => {
    const [project] = await tx
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    const memberships = await tx
      .select({ role: projectMembers.role, status: projectMembers.status })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)))

    const rows = await tx
      .select({
        id: onboardingQuestions.id,
        questionText: onboardingQuestions.questionText,
        questionType: onboardingQuestions.questionType,
        options: onboardingQuestions.options,
      })
      .from(onboardingQuestions)
      .where(eq(onboardingQuestions.projectId, id))
      .orderBy(onboardingQuestions.orderIndex)

    const isAdmin = memberships.some(
      (m) => m.role === 'administrator' && m.status === 'active',
    )

    return { project, isAdmin, rows }
  }).then(({ project, isAdmin, rows }) => ({
    project,
    isAdmin,
    questions: rows.map<OnboardingQuestion>((q) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType === 'multiple_choice' ? 'multiple_choice' : 'open',
      options: coerceOptions(q.options),
    })),
  }))

  if (!project) notFound()
  if (!isAdmin) redirect(`/projects/${id}`)

  return (
    <PageShell
      header={
        <TopBar>
          <BackLink href={`/projects/${id}`}>Voltar ao projeto</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Perguntas de onboarding</PageTitle>
      <PageSubtitle>
        Defina o que os avaliadores respondem ao entrar em “{project.name}”. Todas as
        perguntas são obrigatórias para concluir o onboarding.
      </PageSubtitle>
      <QuestionManager projectId={id} questions={questions} />
    </PageShell>
  )
}
