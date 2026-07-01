import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { withUser, projects, projectMembers, projectInvitations, profiles } from '@/lib/db'
import { acceptInvitation } from '@/app/onboarding/actions'
import { declineInvitation } from '@/app/invitations/actions'
import { taskTypeLabel } from '../task-types'
import { projectStatusLabel, roleLabel, memberStatusLabel } from '../labels'
import { InviteEvaluatorForm } from './invite-evaluator-form'
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Numa transação RLS-aware (papel `authenticated`): o projeto (a RLS só deixa
  // membro/convidado enxergar; quem não participa recebe 0 linhas e cai no notFound), os
  // papéis do usuário neste projeto (uma linha por papel — HU-024), um eventual convite
  // pendente (para oferecer aceitar/recusar) e a lista de membros com nome/e-mail
  // (HU-025 — a RLS pm_select + profiles_select_shared_members recorta o que cada um vê).
  const { project, memberships, pendingInvitation, memberRows } = await withUser(
    user.id,
    async (tx) => {
      const [project] = await tx
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          status: projects.status,
          taskType: projects.taskType,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1)

      const memberships = await tx
        .select({ role: projectMembers.role, status: projectMembers.status })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, user.id)))

      const [pendingInvitation] = await tx
        .select({ id: projectInvitations.id })
        .from(projectInvitations)
        .where(
          and(
            eq(projectInvitations.projectId, id),
            eq(projectInvitations.inviteeId, user.id),
            eq(projectInvitations.status, 'pending'),
          ),
        )
        .limit(1)

      // innerJoin com profiles: só entram membros cujo profile a RLS deixa ler (co-membros
      // de quem é ativo). Um pending_onboarding só é visível ao próprio e ao admin.
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
        .where(eq(projectMembers.projectId, id))

      return { project, memberships, pendingInvitation, memberRows }
    },
  )
  if (!project) notFound()

  const roles = memberships.map((m) => roleLabel(m.role))
  const onboardingPending = memberships.some(
    (m) => m.role === 'evaluator' && m.status === 'pending_onboarding',
  )
  // Só o Administrador ativo convida avaliadores (espelha a RLS inv_insert).
  const isAdmin = memberships.some(
    (m) => m.role === 'administrator' && m.status === 'active',
  )
  const isActiveMember = memberships.some((m) => m.status === 'active')
  const isMember = memberships.length > 0
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
            <span className={`status-badge status-${project.status}`}>
              {projectStatusLabel(project.status)}
            </span>
          </div>

          {roles.length > 0 ? (
            <p className="project-roles">
              Seu papel: {roles.join(' · ')}
              {onboardingPending ? (
                <span className="onboarding-badge">onboarding pendente</span>
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
                  <button type="submit" className="btn-invite btn-inline">
                    Aceitar convite
                  </button>
                </form>
                <form action={declineInvitation}>
                  <input type="hidden" name="invitation_id" value={pendingInvitation.id} />
                  <button type="submit" className="btn-decline">
                    Recusar
                  </button>
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
              <Link href={`/projects/${project.id}/onboarding`} className="btn-invite btn-inline btn-link-inline">
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
                        <span className={`member-status member-status-${m.status}`}>
                          {memberStatusLabel(m.status)}
                        </span>
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
                    </span>
                  </li>
                ))}
              </ul>
            </section>
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
