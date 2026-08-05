import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import {
  transaction,
  projects,
  projectMembers,
  profiles,
  onboardingQuestions,
  onboardingResponses,
} from '@/lib/db'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { cx } from '@/app/components/ui/cx'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'


export default async function MemberResponsesPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id, userId } = await params
  const viewerId = await requireUserId()

  const { project, isAdmin, target, rows } = await transaction(async (tx) => {
    const [project] = await tx
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    const memberships = await tx
      .select({ role: projectMembers.role, status: projectMembers.status })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, viewerId)))
    const isAdmin = memberships.some(
      (m) => m.role === 'administrator' && m.status === 'active',
    )


    const [member] = await tx
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, id),
          eq(projectMembers.userId, userId),
          eq(projectMembers.role, 'evaluator'),
        ),
      )
      .limit(1)

    const [target] = await tx
      .select({ name: profiles.name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)


    const rows =
      isAdmin && member
        ? await tx
            .select({
              questionText: onboardingQuestions.questionText,
              answer: onboardingResponses.answer,
            })
            .from(onboardingQuestions)
            .leftJoin(
              onboardingResponses,
              and(
                eq(onboardingResponses.questionId, onboardingQuestions.id),
                eq(onboardingResponses.projectMemberId, member.id),
              ),
            )
            .where(eq(onboardingQuestions.projectId, id))
            .orderBy(onboardingQuestions.orderIndex)
        : null

    return { project, isAdmin, target, member, rows }
  }).then((r) => ({ ...r, rows: r.isAdmin && r.member ? (r.rows ?? []) : null }))

  if (!project) notFound()
  if (!isAdmin) redirect(`/projects/${id}`)
  if (!rows || !target) notFound()

  return (
    <PageShell
      header={
        <TopBar>
          <BackLink href={`/projects/${id}`}>Voltar ao projeto</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Respostas de onboarding</PageTitle>
      <PageSubtitle>
        {target.name} · {target.email}
      </PageSubtitle>

      {rows.length === 0 ? (
        <EmptyState>Este projeto não tem perguntas de onboarding.</EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {rows.map((r, i) => (
            <li key={i}>
              <Card padding="sm">
                <p className="m-0 mb-1.5 text-[13px] font-semibold text-label">
                  {i + 1}. {r.questionText}
                </p>
                <p
                  className={cx(
                    'm-0 text-sm leading-[1.5] whitespace-pre-wrap',
                    r.answer ? 'text-ink' : 'text-faint italic',
                  )}
                >
                  {r.answer ?? 'Sem resposta'}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
