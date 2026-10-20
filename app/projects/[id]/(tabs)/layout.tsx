import { notFound } from 'next/navigation'
import Link from '@/app/components/app-link'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers, projectInvitations } from '@/lib/db'
import { taskTypeLabel } from '../../task-types'
import { memberStatusLabel, projectStatusLabel, roleLabel } from '../../labels'
import { ProjectTabs } from '../project-tabs'
import { Badge, StatusBadge } from '@/app/components/ui/badge'
import { PageShell, PageTitle } from '@/app/components/ui/shell'
import { cx } from '@/app/components/ui/cx'
import { AppTopBar } from '@/app/components/app-top-bar'
import { loadTopBar } from '@/app/components/app-top-bar-data'
import { PROJECT_PHASES, TOTAL_PHASES } from '../phase-bar'
import { accessRows, canViewProject } from '../../project-access'

export default async function ProjectTabsLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>
  children: React.ReactNode
}) {
  const { id } = await params
  const userId = await requireUserId()
  void loadTopBar(userId)

  const { project, memberships: rows, hasInvitation } = await transaction(async (tx) => {
    const [project] = await tx
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        phase: projects.phase,
        taskType: projects.taskType,
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

  if (!canViewProject({ memberships: rows, hasInvitation })) notFound()

  const memberships = accessRows(rows)
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
        <AppTopBar
          trail={[
            { label: 'Meus projetos', href: '/dashboard' },
            { label: project.name, href: `/projects/${project.id}` },
          ]}
        />
      }
    >
      <header>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <PageTitle>{project.name}</PageTitle>
          <Link
            href={`/projects/${project.id}`}
            className="rounded-full transition-opacity hover:opacity-80"
          >
            <Badge>
              {`Fase ${project.phase} de ${TOTAL_PHASES} · ${PROJECT_PHASES[project.phase - 1].name}`}
            </Badge>
          </Link>
          {project.status !== 'active' ? (
            <StatusBadge status={project.status}>
              {projectStatusLabel(project.status)}
            </StatusBadge>
          ) : null}
          {onboardingPending ? (
            <Badge tone="warning">{memberStatusLabel('pending_onboarding')}</Badge>
          ) : null}
        </div>

        {project.description ? (
          <p className="mt-1.5 truncate text-sm text-muted" title={project.description}>
            {project.description}
          </p>
        ) : null}

        {summary ? (
          <p className={cx('text-sm text-muted', project.description ? 'mt-1' : 'mt-1.5')}>
            {summary}
          </p>
        ) : null}

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
