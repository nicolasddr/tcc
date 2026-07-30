import Link from '@/app/components/app-link'
import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import {
  transaction,
  profiles,
  projectMembers,
  projects as projectsTable,
  notifications as notificationsTable,
} from '@/lib/db'
import { isSuperAdmin, listMyPendingInvitations, type PendingInvitation } from '@/lib/authz'
import { signOut } from '@/app/auth/actions'
import { declineInvitation } from '@/app/invitations/actions'
import { acceptInvitation } from '@/app/onboarding/actions'
import { ProcessOverview } from '@/app/components/process-overview'
import { ProcessPhasesFooter } from '@/app/components/process-phases-footer'
import { NotificationBell, type InboxItem } from '@/app/components/notification-bell'
import { SubmitButton } from '@/app/components/submit-button'
import { Badge, StatusBadge } from '@/app/components/ui/badge'
import {
  notificationText,
  formatDate,
  type NotificationPayload,
} from '@/app/notifications/labels'
import { projectStatusLabel, roleLabel } from '@/app/projects/labels'
import './dashboard.css'
import '@/app/projects/projects.css'
import '@/app/notifications/notifications.css'

type ListedProject = {
  id: string
  name: string
  status: string
  roles: string[]
  onboardingPending: boolean
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ arquivados?: string }>
}) {
  const showArchived = (await searchParams).arquivados === '1'
  const claims = await getClaims()
  if (!claims) redirect('/login')

  const userId = claims.sub
  const avatarUrl = claims.user_metadata?.avatar_url ?? claims.user_metadata?.picture
  const email = claims.email ?? ''
  const initial = email.charAt(0)


  const { profileRows, membershipRows, notificationRows } = await transaction(async (tx) => {

    const profileRows = await tx
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)


    const membershipRows = await tx
      .select({
        role: projectMembers.role,
        status: projectMembers.status,
        project: {
          id: projectsTable.id,
          name: projectsTable.name,
          status: projectsTable.status,
        },
      })
      .from(projectMembers)
      .innerJoin(projectsTable, eq(projectMembers.projectId, projectsTable.id))
      .where(eq(projectMembers.userId, userId))

    const notificationRows = await tx
      .select({
        id: notificationsTable.id,
        type: notificationsTable.type,
        payload: notificationsTable.payload,
        readAt: notificationsTable.readAt,
        createdAt: notificationsTable.createdAt,
      })
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(30)

    return { profileRows, membershipRows, notificationRows }
  })

  const pendingInvitationRows = await listMyPendingInvitations(userId)

  const superAdmin = await isSuperAdmin(userId)

  const displayName = profileRows[0]?.name ?? email

  const byProject = new Map<string, ListedProject>()
  let hasArchived = false
  for (const row of membershipRows) {
    const p = row.project
    if (p.status === 'archived') {
      hasArchived = true
      if (!showArchived) continue 
    }
    let entry = byProject.get(p.id)
    if (!entry) {
      entry = { id: p.id, name: p.name, status: p.status, roles: [], onboardingPending: false }
      byProject.set(p.id, entry)
    }
    if (!entry.roles.includes(row.role)) entry.roles.push(row.role)
    if (row.role === 'evaluator' && row.status === 'pending_onboarding') {
      entry.onboardingPending = true
    }
  }
  const projects = [...byProject.values()]


  const inboxItems: InboxItem[] = notificationRows.map((n) => ({
    id: n.id,
    text: notificationText(n.type, (n.payload ?? {}) as NotificationPayload),
    dateLabel: formatDate(n.createdAt),
    read: n.readAt != null,
  }))

  const pendingInvitations: PendingInvitation[] = pendingInvitationRows

  const invitedProjects = pendingInvitations.filter((inv) => !byProject.has(inv.projectId))
  const hasProjects = projects.length > 0 || invitedProjects.length > 0

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link href="/profile" className="dashboard-user" title="Editar meu perfil">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="dashboard-avatar" src={avatarUrl} alt="" />
          ) : (
            <span className="dashboard-avatar-fallback">{initial}</span>
          )}
          <span className="dashboard-identity">
            <span className="dashboard-name">{displayName}</span>
            <span className="dashboard-email">{email}</span>
          </span>
        </Link>
        <NotificationBell items={inboxItems} />
        <form action={signOut} className="dashboard-logout-form">
          <SubmitButton className="dashboard-logout" pendingText="Saindo…">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </SubmitButton>
        </form>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <section className="projects-section">
            <div className="projects-section-head">
              <h1 className="projects-title">Meus projetos</h1>
              <div className="projects-head-actions">
                {superAdmin ? (
                  <Link href="/admin/permissions" className="projects-filter-toggle">
                    Solicitações de permissão
                  </Link>
                ) : null}
                {hasArchived ? (
                  <Link
                    href={showArchived ? '/dashboard' : '/dashboard?arquivados=1'}
                    className="projects-filter-toggle"
                  >
                    {showArchived ? 'Ocultar arquivados' : 'Mostrar arquivados'}
                  </Link>
                ) : null}
                <Link href="/projects/new" className="btn-new-project">
                  + Novo projeto
                </Link>
              </div>
            </div>

            {!hasProjects ? (
              <p className="projects-empty">
                Você ainda não participa de nenhum projeto. Crie o primeiro para começar.
              </p>
            ) : (
              <ul className="projects-list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="project-card">
                      <span className="project-card-main">
                        <span className="project-card-name">{p.name}</span>
                        <span className="project-card-roles">
                          {p.roles.map(roleLabel).join(' · ')}
                        </span>
                      </span>
                      <span className="project-card-badges">
                        {p.onboardingPending ? (
                          <Badge tone="warning">onboarding pendente</Badge>
                        ) : null}
                        <StatusBadge status={p.status}>
                          {projectStatusLabel(p.status)}
                        </StatusBadge>
                      </span>
                    </Link>
                  </li>
                ))}

                {/* Convites pendentes: aparecem na listagem para o usuário agir
                    (Aceitar materializa o membro em onboarding; Recusar encerra o convite). */}
                {invitedProjects.map((inv) => (
                  <li key={inv.invitationId}>
                    <div className="project-card project-card-invited">
                      <Link
                        href={`/projects/${inv.projectId}`}
                        className="project-card-main project-card-link"
                      >
                        <span className="project-card-name">{inv.projectName}</span>
                        <span className="project-card-roles">
                          Convidado por {inv.inviterName ?? 'um administrador'} ·{' '}
                          {formatDate(inv.createdAt)}
                        </span>
                      </Link>
                      <span className="project-card-badges">
                        <span className="invite-pending-badge">convite pendente</span>
                        <form action={acceptInvitation}>
                          <input type="hidden" name="project_id" value={inv.projectId} />
                          <SubmitButton variant="primary" size="sm" pendingText="Aceitando…">
                            Aceitar
                          </SubmitButton>
                        </form>
                        <form action={declineInvitation}>
                          <input type="hidden" name="invitation_id" value={inv.invitationId} />
                          <SubmitButton variant="danger" size="sm" pendingText="Recusando…">
                            Recusar
                          </SubmitButton>
                        </form>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ProcessOverview
            createAction={
              <Link href="/projects/new" className="btn-role-primary btn-link">
                Criar Novo Projeto
              </Link>
            }
            joinAction={<button type="button" className="btn-role-outline">Entrar no Projeto</button>}
          />
        </div>
      </main>

      <ProcessPhasesFooter />
    </div>
  )
}
