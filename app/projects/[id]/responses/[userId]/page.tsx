import Link from '@/app/components/app-link'
import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import {
  withUser,
  projects,
  projectMembers,
  profiles,
  onboardingQuestions,
  onboardingResponses,
} from '@/lib/db'
import '../../../projects.css'
import '@/app/notifications/notifications.css'

// HU-029 (US 33): o Administrador vê as respostas de onboarding de um avaliador (somente
// leitura). O gate é EXPLÍCITO na app: só um admin ativo do projeto passa (`isAdmin`,
// espelha a via admin de can_view_response/or_select) — os demais são redirecionados e a
// leitura das respostas só ocorre para o admin. A RLS segue como backstop.
// Um leftJoin lista as perguntas mesmo sem resposta (perguntas criadas após o onboarding).
export default async function MemberResponsesPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id, userId } = await params
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const viewerId = claims.sub

  const { project, isAdmin, target, rows } = await withUser(viewerId, async (tx) => {
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

    // A linha de avaliador do usuário-alvo (o consumidor das respostas).
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

    // Escopo can_view_response: só lê as respostas se o viewer é admin do projeto (e o
    // alvo é avaliador). Para os demais nem consultamos — o redirect abaixo já os barra.
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
    <div className="project-page">
      <header className="project-topbar">
        <Link href={`/projects/${id}`} className="project-back">
          ← Voltar ao projeto
        </Link>
      </header>

      <main className="project-main">
        <div className="project-narrow">
          <h1 className="project-page-title">Respostas de onboarding</h1>
          <p className="project-page-subtitle">
            {target.name} · {target.email}
          </p>

          {rows.length === 0 ? (
            <p className="projects-empty">
              Este projeto não tem perguntas de onboarding.
            </p>
          ) : (
            <ul className="responses-list">
              {rows.map((r, i) => (
                <li key={i} className="response-item">
                  <p className="response-question">
                    {i + 1}. {r.questionText}
                  </p>
                  {r.answer ? (
                    <p className="response-answer">{r.answer}</p>
                  ) : (
                    <p className="response-answer response-answer-empty">Sem resposta</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
