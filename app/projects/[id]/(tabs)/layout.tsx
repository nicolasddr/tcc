import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers, projectInvitations } from '@/lib/db'
import { taskTypeLabel } from '../../task-types'
import { projectStatusLabel, roleLabel } from '../../labels'
import { ProjectTabs } from '../project-tabs'
import { Badge, StatusBadge } from '@/app/components/ui/badge'
import { PageShell, TopBar, BackLink, PageTitle } from '@/app/components/ui/shell'
import { InfoTooltip } from '@/app/components/ui/tooltip'

export default async function ProjectTabsLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>
  children: React.ReactNode
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { project, memberships, hasInvitation } = await transaction(async (tx) => {
    const [project] = await tx
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        taskType: projects.taskType,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    const memberships = await tx
      .select({ role: projectMembers.role, status: projectMembers.status })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)))

    const [invitation] = await tx
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

    return { project, memberships, hasInvitation: Boolean(invitation) }
  })
  if (!project) notFound()

  const canView =
    project.createdBy === userId || memberships.length > 0 || hasInvitation
  if (!canView) notFound()

  const roles = memberships.map((m) => roleLabel(m.role))
  const onboardingPending = memberships.some(
    (m) => m.role === 'evaluator' && m.status === 'pending_onboarding',
  )
  const isAdmin = memberships.some(
    (m) => m.role === 'administrator' && m.status === 'active',
  )
  const isEvaluator = memberships.some(
    (m) => m.role === 'evaluator' && m.status === 'active',
  )
  const isActiveMember = memberships.some((m) => m.status === 'active')
  const isMember = memberships.length > 0
  const summary = [taskTypeLabel(project.taskType), roles.join(' e ')]
    .filter(Boolean)
    .join(' · ')

  return (
    <PageShell
      width="wide"
      header={
        <TopBar>
          <BackLink href="/dashboard">Meus projetos</BackLink>
        </TopBar>
      }
    >
      <header>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <PageTitle>{project.name}</PageTitle>
          {project.description ? (
            <InfoTooltip text={project.description} />
          ) : null}
          <StatusBadge status={project.status}>
            {projectStatusLabel(project.status)}
          </StatusBadge>
          {onboardingPending ? (
            <Badge tone="warning">onboarding pendente</Badge>
          ) : null}
        </div>

        {summary ? <p className="mt-1.5 text-sm text-muted">{summary}</p> : null}

        {isMember ? (
          <ProjectTabs
            projectId={project.id}
            isAdmin={isAdmin}
            isEvaluator={isEvaluator}
            isActiveMember={isActiveMember}
          />
        ) : null}
      </header>

      {children}
    </PageShell>
  )
}
