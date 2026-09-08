import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers, projectInvitations } from '@/lib/db'
import { taskTypeLabel } from '../../task-types'
import { projectStatusLabel, roleLabel } from '../../labels'
import { ProjectTabs } from '../project-tabs'
import { Badge, StatusBadge } from '@/app/components/ui/badge'
import { Chip, ChipLink } from '@/app/components/ui/chip'
import { PageShell, TopBar, BackLink, PageTitle } from '@/app/components/ui/shell'
import {
  UsersIcon,
  SlidersIcon,
  TagIcon,
  UserIcon,
  ChevronRightIcon,
} from '@/app/components/ui/icons'

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
  const isActiveMember = memberships.some((m) => m.status === 'active')
  const isMember = memberships.length > 0
  const taskType = taskTypeLabel(project.taskType)

  return (
    <PageShell
      width="wide"
      header={
        <TopBar>
          <BackLink href="/dashboard" />
        </TopBar>
      }
    >
      <header>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <PageTitle>{project.name}</PageTitle>
          <StatusBadge status={project.status}>
            {projectStatusLabel(project.status)}
          </StatusBadge>
          {onboardingPending ? (
            <Badge tone="warning">onboarding pendente</Badge>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip icon={<TagIcon />}>{taskType ?? 'Não declarado'}</Chip>
          {roles.length > 0 ? (
            <Chip icon={<UserIcon />}>{roles.join(' · ')}</Chip>
          ) : null}
          {isActiveMember ? (
            <ChipLink href={`/projects/${project.id}/members`} icon={<UsersIcon />}>
              Membros
            </ChipLink>
          ) : null}
          {isAdmin ? (
            <ChipLink
              href={`/projects/${project.id}/settings`}
              icon={<SlidersIcon />}
            >
              Ajustes
            </ChipLink>
          ) : null}
        </div>

        {project.description ? (
          <details className="group mt-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-control text-[12.5px] font-semibold text-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ring [&::-webkit-details-marker]:hidden">
              <ChevronRightIcon className="transition-transform group-open:rotate-90" />
              Sobre o projeto
            </summary>
            <p className="mt-2 max-w-[68ch] text-[13.5px] leading-relaxed text-label">
              {project.description}
            </p>
          </details>
        ) : null}

        {isMember ? <ProjectTabs projectId={project.id} isAdmin={isAdmin} /> : null}
      </header>

      {children}
    </PageShell>
  )
}
