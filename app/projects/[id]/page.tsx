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
import { RemoveMemberButton, LeaveProjectButton } from './member-actions'
import { ProjectTabs } from './project-tabs'
import { SubmitButton } from '@/app/components/submit-button'
import { Button, ButtonLink } from '@/app/components/ui/button'
import { Badge, StatusBadge } from '@/app/components/ui/badge'
import { Avatar } from '@/app/components/ui/avatar'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Panel, Callout } from '@/app/components/ui/panel'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { StatCard, ProgressBar } from '@/app/components/ui/stat'
import { Section } from '@/app/components/ui/section'
import { PageShell, TopBar, BackLink, PageTitle } from '@/app/components/ui/shell'
import {
  UsersIcon,
  BookIcon,
  ArrowRightIcon,
  SlidersIcon,
} from '@/app/components/ui/icons'

const TOTAL_PHASES = 4

const soonBadge = <Badge tone="neutral">em breve</Badge>

function Meta({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
        {term}
      </dt>
      <dd className="m-0 text-[13px] font-medium text-ink">{value}</dd>
    </div>
  )
}

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
  const showMembers = isActiveMember && members.length > 0
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
            {project.description ? <InfoTooltip text={project.description} /> : null}
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
            >
              <SlidersIcon />
              Configurações
            </ButtonLink>
          ) : null}
        </div>

        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
          <Meta term="Tipo de tarefa" value={taskType ?? 'Não declarado'} />
          <Meta term="Criado em" value={formatDate(project.createdAt)} />
          {roles.length > 0 ? <Meta term="Seu papel" value={roles.join(' · ')} /> : null}
        </dl>
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
          hint="Você aceitou o convite. Falta registrar o consentimento para ativar sua participação como avaliador."
          action={
            <ButtonLink href={`/projects/${project.id}/onboarding`}>
              Concluir onboarding
            </ButtonLink>
          }
        />
      ) : null}

      {isMember ? (
        <>
          <ProjectTabs />

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Fase atual"
              value="1"
              suffix={`/ ${TOTAL_PHASES}`}
              hint="Configuração inicial"
              badge={soonBadge}
            >
              <ProgressBar value={1} max={TOTAL_PHASES} />
            </StatCard>

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

          <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
            {/* Lista de membros (HU-025): visível a quem já participa ativamente. */}
            <Panel
              title="Membros"
              icon={<UsersIcon />}
              action={
                showMembers ? (
                  <span className="text-[13px] text-muted">{members.length}</span>
                ) : null
              }
            >
              {showMembers ? (
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {members.map((m) => (
                    <li
                      key={m.userId}
                      className="flex items-center gap-2.5 rounded-control px-1 py-1.5"
                    >
                      <Avatar fallback={m.name.charAt(0)} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-semibold text-ink">
                          {m.name}
                        </span>
                        <span className="truncate text-[11px] text-muted">
                          {m.roles.map(roleLabel).join(' · ')}
                          {m.email !== m.name ? ` · ${m.email}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5">
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
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>
                  A lista de membros aparece depois que você conclui o onboarding.
                </EmptyState>
              )}

              {isAdmin ? (
                <div className="mt-4 border-t border-line pt-4">
                  <InviteEvaluatorForm projectId={project.id} />
                </div>
              ) : null}
            </Panel>

            <Panel title="Codebook" icon={<BookIcon />} action={soonBadge}>
              <EmptyState>
                Nenhuma versão registrada. As definições e os critérios que orientam a
                avaliação entram aqui.
              </EmptyState>
            </Panel>
          </div>

          {isAdmin && project.status === 'active' ? (
            <Callout
              className="mt-3"
              title="Pronto para avançar?"
              hint="Quando o prompt estiver validado, avance para a próxima fase do processo."
              action={
                <Button disabled title="Ainda não implementado">
                  Avançar fase
                  <ArrowRightIcon />
                </Button>
              }
            />
          ) : null}
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
