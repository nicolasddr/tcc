import Link from '@/app/components/app-link'
import { notFound, redirect } from 'next/navigation'
import { and, eq, ne, or } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { transaction, projects, projectMembers, projectInvitations, profiles } from '@/lib/db'
import { acceptInvitation } from '@/app/onboarding/actions'
import { declineInvitation } from '@/app/invitations/actions'
import { taskTypeLabel } from '../task-types'
import { projectStatusLabel, roleLabel, memberStatusLabel } from '../labels'
import { InviteEvaluatorForm } from './invite-evaluator-form'
import { ManageProject } from './manage-project'
import { RemoveMemberButton, LeaveProjectButton } from './member-actions'
import { SubmitButton } from '@/app/components/submit-button'
import { buttonClass } from '@/app/components/ui/button'
import { Badge, StatusBadge } from '@/app/components/ui/badge'
import '../projects.css'
import '@/app/notifications/notifications.css'

type ListedMember = {
  userId: string
  name: string
  email: string
  roles: string[]
  status: string // status agregado do usuário no projeto
}

// Status agregado quando o usuário tem mais de uma linha (ex.: admin que também é
// avaliador): ativo se qualquer papel estiver ativo; senão pendente; senão inativo.
function aggregateStatus(statuses: string[]): string {
  if (statuses.includes('active')) return 'active'
  if (statuses.includes('pending_onboarding')) return 'pending_onboarding'
  return 'inactive'
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  // Numa única transação, com o ESCOPO explícito na app (ver ADR 0007): o projeto (por
  // id), os papéis do usuário neste projeto (uma linha por papel — HU-024), um eventual
  // convite pendente (para oferecer aceitar/recusar) e a lista de membros com nome/e-mail
  // (HU-025).
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

    // Escopo explícito da lista de membros: o admin vê todas as linhas; um membro ativo
    // vê as não-`pending_onboarding` (mais a própria); quem não é ativo vê só a própria.
    // O innerJoin com profiles só traz perfis de co-membros do projeto.
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

  // Escopo explícito de VISIBILIDADE do projeto: só o criador, um membro (qualquer status)
  // ou um convidado pendente enxerga — quem não participa cai no notFound.
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
  // Só um avaliador ativo que NÃO é administrador pode sair voluntariamente (HU-022);
  // o Administrador gere o ciclo do projeto, não "sai" dele.
  const canLeave =
    !isAdmin && memberships.some((m) => m.role === 'evaluator' && m.status === 'active')
  const taskType = taskTypeLabel(project.taskType)

  // Agrega os membros por usuário (o admin-avaliador tem duas linhas — HU-024).
  const byUser = new Map<string, ListedMember & { _statuses: string[] }>()
  for (const row of memberRows) {
    let entry = byUser.get(row.userId)
    if (!entry) {
      entry = {
        userId: row.userId,
        name: row.name,
        email: row.email,
        roles: [],
        status: row.status,
        _statuses: [],
      }
      byUser.set(row.userId, entry)
    }
    if (!entry.roles.includes(row.role)) entry.roles.push(row.role)
    entry._statuses.push(row.status)
  }
  const members: ListedMember[] = [...byUser.values()]
    .map((m) => ({ ...m, status: aggregateStatus(m._statuses) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="project-page">
      <header className="project-topbar">
        <Link href="/dashboard" className="project-back">
          ← Voltar
        </Link>
      </header>

      <main className="project-main">
        <div className="project-narrow">
          <div className="project-heading-row">
            <h1 className="project-page-title">{project.name}</h1>
            <StatusBadge status={project.status}>
              {projectStatusLabel(project.status)}
            </StatusBadge>
          </div>

          {roles.length > 0 ? (
            <p className="project-roles">
              Seu papel: {roles.join(' · ')}
              {onboardingPending ? (
                <Badge tone="warning">onboarding pendente</Badge>
              ) : null}
            </p>
          ) : null}

          {project.description ? (
            <p className="project-description">{project.description}</p>
          ) : (
            <p className="project-description project-description-empty">Sem descrição.</p>
          )}

          <dl className="project-meta">
            <div className="project-meta-row">
              <dt>Tipo de tarefa</dt>
              <dd>{taskType ?? 'Não declarado'}</dd>
            </div>
          </dl>

          {/* Convite pendente: o convidado (ainda não-membro) aceita ou recusa aqui. */}
          {pendingInvitation && !isMember ? (
            <section className="project-section">
              <h2 className="project-section-title">Você foi convidado para este projeto</h2>
              <p className="project-section-hint">
                Ao aceitar, você passa por um onboarding rápido (consentimento) antes de
                participar como avaliador.
              </p>
              <div className="invite-actions">
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
            </section>
          ) : null}

          {/* Onboarding a concluir: já aceitou, falta consentir. */}
          {onboardingPending ? (
            <section className="project-section">
              <h2 className="project-section-title">Conclua seu onboarding</h2>
              <p className="project-section-hint">
                Você aceitou o convite. Falta registrar o consentimento para ativar sua
                participação como avaliador.
              </p>
              <Link
                href={`/projects/${project.id}/onboarding`}
                className={buttonClass('primary')}
              >
                Concluir onboarding
              </Link>
            </section>
          ) : null}

          {/* Lista de membros (HU-025): visível a quem já participa ativamente. */}
          {isActiveMember && members.length > 0 ? (
            <section className="project-section">
              <h2 className="project-section-title">Membros</h2>
              <ul className="members-list">
                {members.map((m) => (
                  <li key={m.userId} className="member-row">
                    <span className="member-main">
                      <span className="member-name">{m.name}</span>
                      <span className="member-email">{m.email}</span>
                    </span>
                    <span className="member-badges">
                      <span className="member-roles">
                        {m.roles.map(roleLabel).join(' · ')}
                      </span>
                      {m.status !== 'active' ? (
                        <StatusBadge status={m.status}>
                          {memberStatusLabel(m.status)}
                        </StatusBadge>
                      ) : null}
                      {/* HU-029: só o admin, e só para quem é avaliador. */}
                      {isAdmin && m.roles.includes('evaluator') ? (
                        <Link
                          href={`/projects/${project.id}/responses/${m.userId}`}
                          className="member-link"
                        >
                          Ver respostas
                        </Link>
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
            </section>
          ) : null}

          {/* HU-022: um avaliador ativo (não-admin) pode sair voluntariamente. */}
          {canLeave ? (
            <section className="project-section">
              <h2 className="project-section-title">Sair do projeto</h2>
              <p className="project-section-hint">
                Você deixa de participar como avaliador. Suas avaliações são preservadas,
                mas só o administrador poderá readmiti-lo depois.
              </p>
              <LeaveProjectButton projectId={project.id} />
            </section>
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
            <section className="project-section">
              <h2 className="project-section-title">Onboarding dos avaliadores</h2>
              <p className="project-section-hint">
                Defina as perguntas (abertas ou de múltipla escolha) que os avaliadores
                respondem ao entrar no projeto.
              </p>
              <Link
                href={`/projects/${project.id}/questions`}
                className="btn-secondary"
              >
                Gerenciar perguntas de onboarding
              </Link>
            </section>
          ) : null}

          {isAdmin ? (
            <section className="project-section">
              <h2 className="project-section-title">Convidar avaliador</h2>
              <p className="project-section-hint">
                Informe o e-mail de quem já tem conta. O convidado recebe uma notificação e
                pode aceitar ou recusar.
              </p>
              <InviteEvaluatorForm projectId={project.id} />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  )
}
