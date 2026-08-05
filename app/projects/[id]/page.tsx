import { notFound } from 'next/navigation'
import { and, eq, ne, or } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers, projectInvitations, profiles } from '@/lib/db'
import { acceptInvitation } from '@/app/onboarding/actions'
import { declineInvitation } from '@/app/invitations/actions'
import { taskTypeLabel } from '../task-types'
import { formatDate } from '@/app/notifications/labels'
import { projectStatusLabel, roleLabel, memberStatusLabel } from '../labels'
import { groupMembers } from '../members'
import { InviteEvaluatorForm } from './invite-evaluator-form'
import { ManageProject } from './manage-project'
import { RemoveMemberButton, LeaveProjectButton } from './member-actions'
import { SubmitButton } from '@/app/components/submit-button'
import { ButtonLink } from '@/app/components/ui/button'
import { Badge, StatusBadge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { Section } from '@/app/components/ui/section'
import { PageShell, TopBar, BackLink, PageTitle } from '@/app/components/ui/shell'
import { cx } from '@/app/components/ui/cx'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()


  const { project, memberships, pendingInvitation, memberRows } = await transaction(async (tx) => {
    const [project] = await tx
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        taskType: projects.taskType,
        createdAt: projects.createdAt,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    const memberships = await tx
      .select({ role: projectMembers.role, status: projectMembers.status })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)))

    const [pendingInvitation] = await tx
      .select({ id: projectInvitations.id })
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.projectId, id),
          eq(projectInvitations.inviteeId, userId),
          eq(projectInvitations.status, 'pending'),
        ),
      )
      .limit(1)

    const viewerIsAdmin = memberships.some(
      (m) => m.role === 'administrator' && m.status === 'active',
    )
    const viewerIsActive = memberships.some((m) => m.status === 'active')
    const memberScope = viewerIsAdmin
      ? undefined
      : viewerIsActive
        ? or(eq(projectMembers.userId, userId), ne(projectMembers.status, 'pending_onboarding'))
        : eq(projectMembers.userId, userId)
    const memberRows = await tx
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        status: projectMembers.status,
        name: profiles.name,
        email: profiles.email,
      })
      .from(projectMembers)
      .innerJoin(profiles, eq(profiles.id, projectMembers.userId))
      .where(and(eq(projectMembers.projectId, id), memberScope))

    return { project, memberships, pendingInvitation, memberRows }
  })
  if (!project) notFound()

  const canView =
    project.createdBy === userId ||
    memberships.length > 0 ||
    Boolean(pendingInvitation)
  if (!canView) notFound()

  const roles = memberships.map((m) => roleLabel(m.role))
  const onboardingPending = memberships.some(
    (m) => m.role === 'evaluator' && m.status === 'pending_onboarding',
  )
  // Só o Administrador ativo convida avaliadores.
  const isAdmin = memberships.some(
    (m) => m.role === 'administrator' && m.status === 'active',
  )
  const isActiveMember = memberships.some((m) => m.status === 'active')
  const isMember = memberships.length > 0

  const canLeave =
    !isAdmin && memberships.some((m) => m.role === 'evaluator' && m.status === 'active')
  const taskType = taskTypeLabel(project.taskType)


  const members = groupMembers(memberRows)

  return (
    <PageShell
      header={
        <TopBar>
          <BackLink href="/dashboard" />
        </TopBar>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <PageTitle>{project.name}</PageTitle>
        <StatusBadge status={project.status}>
          {projectStatusLabel(project.status)}
        </StatusBadge>
      </div>

      {roles.length > 0 ? (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-label">
          Seu papel: {roles.join(' · ')}
          {onboardingPending ? <Badge tone="warning">onboarding pendente</Badge> : null}
        </p>
      ) : null}

      <Card padding="lg" className="mt-5">
        <p
          className={cx(
            'm-0 text-[15px] leading-[1.6] whitespace-pre-wrap',
            project.description ? 'text-ink-soft' : 'text-faint',
          )}
        >
          {project.description ?? 'Sem descrição.'}
        </p>

        <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex gap-3">
            <dt className="min-w-[120px] text-[13px] text-muted">Tipo de tarefa</dt>
            <dd className="m-0 text-[13px] text-ink">{taskType ?? 'Não declarado'}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="min-w-[120px] text-[13px] text-muted">Criado em</dt>
            <dd className="m-0 text-[13px] text-ink">{formatDate(project.createdAt)}</dd>
          </div>
        </dl>
      </Card>

      {/* Convite pendente: o convidado (ainda não-membro) aceita ou recusa aqui. */}
      {pendingInvitation && !isMember ? (
        <Section
          title="Você foi convidado para este projeto"
          hint="Ao aceitar, você passa por um onboarding rápido (consentimento) antes de participar como avaliador."
        >
          <div className="flex flex-wrap items-center gap-3">
            <form action={acceptInvitation}>
              <input type="hidden" name="project_id" value={project.id} />
              <SubmitButton variant="primary" pendingText="Aceitando…">
                Aceitar convite
              </SubmitButton>
            </form>
            <form action={declineInvitation}>
              <input type="hidden" name="invitation_id" value={pendingInvitation.id} />
              <SubmitButton variant="danger" pendingText="Recusando…">
                Recusar
              </SubmitButton>
            </form>
          </div>
        </Section>
      ) : null}

      {/* Onboarding a concluir: já aceitou, falta consentir. */}
      {onboardingPending ? (
        <Section
          title="Conclua seu onboarding"
          hint="Você aceitou o convite. Falta registrar o consentimento para ativar sua participação como avaliador."
        >
          <ButtonLink href={`/projects/${project.id}/onboarding`}>
            Concluir onboarding
          </ButtonLink>
        </Section>
      ) : null}

      {/* Lista de membros (HU-025): visível a quem já participa ativamente. */}
      {isActiveMember && members.length > 0 ? (
        <Section title={`Membros (${members.length})`}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {members.map((m) => (
              <li key={m.userId}>
                <Card
                  padding="sm"
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-ink">
                      {m.name}
                    </span>
                    {m.email !== m.name ? (
                      <span className="truncate text-xs text-muted">{m.email}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="text-xs text-label">
                      {m.roles.map(roleLabel).join(' · ')}
                    </span>
                    {m.status !== 'active' ? (
                      <StatusBadge status={m.status}>
                        {memberStatusLabel(m.status)}
                      </StatusBadge>
                    ) : null}
                    {/* HU-029: só o admin, e só para quem é avaliador. */}
                    {isAdmin && m.roles.includes('evaluator') ? (
                      <ButtonLink
                        href={`/projects/${project.id}/responses/${m.userId}`}
                        variant="link"
                      >
                        Ver respostas
                      </ButtonLink>
                    ) : null}
                    {/* HU-021: o admin remove um avaliador ativo (não a si mesmo,
                        nem outro administrador). */}
                    {isAdmin &&
                    m.roles.includes('evaluator') &&
                    !m.roles.includes('administrator') &&
                    m.status === 'active' &&
                    m.userId !== userId ? (
                      <RemoveMemberButton
                        projectId={project.id}
                        memberUserId={m.userId}
                        memberName={m.name}
                      />
                    ) : null}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* HU-022: um avaliador ativo (não-admin) pode sair voluntariamente. */}
      {canLeave ? (
        <Section
          title="Sair do projeto"
          hint="Você deixa de participar como avaliador. Suas avaliações são preservadas, mas só o administrador poderá readmiti-lo depois."
        >
          <LeaveProjectButton projectId={project.id} />
        </Section>
      ) : null}

      {/* HU-014–017: gerência do ciclo de vida do projeto (editar / concluir /
          arquivar / reativar), só para o Administrador. */}
      {isAdmin ? (
        <ManageProject
          projectId={project.id}
          status={project.status}
          name={project.name}
          description={project.description}
        />
      ) : null}

      {isAdmin ? (
        <Section
          title="Onboarding dos avaliadores"
          hint="Defina as perguntas (abertas ou de múltipla escolha) que os avaliadores respondem ao entrar no projeto."
        >
          <ButtonLink href={`/projects/${project.id}/questions`} variant="secondary">
            Gerenciar perguntas de onboarding
          </ButtonLink>
        </Section>
      ) : null}

      {isAdmin ? (
        <Section
          title="Convidar avaliador"
          hint="Informe o e-mail de quem já tem conta. O convidado recebe uma notificação e pode aceitar ou recusar."
        >
          <InviteEvaluatorForm projectId={project.id} />
        </Section>
      ) : null}
    </PageShell>
  )
}
