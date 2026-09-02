import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers, projectInvitations } from '@/lib/db'
import { listProjectMembers } from '@/lib/authz'
import { acceptInvitation } from '@/app/onboarding/actions'
import { declineInvitation } from '@/app/invitations/actions'
import { taskTypeLabel } from '../task-types'
import { formatDate } from '@/app/notifications/labels'
import { projectStatusLabel, roleLabel } from '../labels'
import { groupMembers } from '../members'
import { LeaveProjectButton } from './member-actions'
import { ProjectTabs } from './project-tabs'
import { PhaseBar } from './phase-bar'
import { PHASE_1 } from './pipeline/preconditions'
import { SubmitButton } from '@/app/components/submit-button'
import { ButtonLink } from '@/app/components/ui/button'
import { Badge, StatusBadge } from '@/app/components/ui/badge'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Panel, Callout } from '@/app/components/ui/panel'
import { Chip, ChipLink } from '@/app/components/ui/chip'
import { StatCard } from '@/app/components/ui/stat'
import { Section } from '@/app/components/ui/section'
import { PageShell, TopBar, BackLink, PageTitle } from '@/app/components/ui/shell'
import {
  UsersIcon,
  BookIcon,
  ArrowRightIcon,
  SlidersIcon,
  TagIcon,
  CalendarIcon,
  UserIcon,
  ChevronRightIcon,
} from '@/app/components/ui/icons'

const soonBadge = <Badge tone="neutral">em breve</Badge>

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
        phase: projects.phase,
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
    const memberRows = await listProjectMembers(
      userId,
      id,
      { isAdmin: viewerIsAdmin, isActive: viewerIsActive },
      tx,
    )

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
  const activeEvaluators = members.filter(
    (m) => m.roles.includes('evaluator') && m.status === 'active',
  ).length
  const inOnboarding = members.filter((m) => m.status === 'pending_onboarding').length

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
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <PageTitle>{project.name}</PageTitle>
            <StatusBadge status={project.status}>
              {projectStatusLabel(project.status)}
            </StatusBadge>
            {onboardingPending ? (
              <Badge tone="warning">onboarding pendente</Badge>
            ) : null}
          </div>

          {isAdmin ? (
            <ButtonLink
              href={`/projects/${project.id}/settings`}
              variant="secondary"
              size="sm"
              className="shrink-0"
            >
              <SlidersIcon />
              Configurações
            </ButtonLink>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip icon={<TagIcon />}>{taskType ?? 'Não declarado'}</Chip>
          <Chip icon={<CalendarIcon />}>{formatDate(project.createdAt)}</Chip>
          {roles.length > 0 ? (
            <Chip icon={<UserIcon />}>{roles.join(' · ')}</Chip>
          ) : null}
          {isActiveMember ? (
            <ChipLink href={`/projects/${project.id}/members`} icon={<UsersIcon />}>
              Membros
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
      </header>

      {/* Convite pendente: o convidado (ainda não-membro) aceita ou recusa aqui. */}
      {pendingInvitation && !isMember ? (
        <Callout
          className="mt-6"
          tone="accent"
          title="Você foi convidado para este projeto"
          hint="Ao aceitar, você passa por um onboarding rápido (consentimento) antes de participar como avaliador."
          action={
            <>
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
            </>
          }
        />
      ) : null}

      {/* Onboarding a concluir: já aceitou, falta consentir. */}
      {onboardingPending ? (
        <Callout
          className="mt-6"
          tone="accent"
          title="Conclua seu onboarding"
          hint="Falta registrar o consentimento e responder o questionário de perfil para ativar sua participação como avaliador."
          action={
            <ButtonLink href={`/projects/${project.id}/onboarding`}>
              Concluir onboarding
            </ButtonLink>
          }
        />
      ) : null}

      {isMember ? (
        <>
          <ProjectTabs projectId={project.id} isAdmin={isAdmin} />

          <PhaseBar
            className="mt-4"
            current={project.phase}
            action={
              isAdmin && project.status === 'active' && project.phase === PHASE_1 ? (
                <ButtonLink href={`/projects/${project.id}/pipeline#avancar`}>
                  Avançar fase
                  <ArrowRightIcon />
                </ButtonLink>
              ) : null
            }
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Avaliadores"
              value={activeEvaluators}
              hint={
                inOnboarding > 0 ? `${inOnboarding} em onboarding` : 'ativos no projeto'
              }
            />

            <StatCard
              label="Concordância"
              value="—"
              hint="ICR entre avaliadores"
              badge={soonBadge}
            />

            <StatCard
              label="Avaliações"
              value="—"
              hint="Respostas avaliadas"
              badge={soonBadge}
            />
          </div>

          <Panel
            className="mt-3"
            title="Codebook"
            icon={<BookIcon />}
            action={soonBadge}
          >
            <EmptyState>
              Nenhuma versão registrada. As definições e os critérios que orientam a
              avaliação entram aqui.
            </EmptyState>
          </Panel>
        </>
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
    </PageShell>
  )
}
