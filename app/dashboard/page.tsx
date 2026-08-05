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
import { Button, ButtonLink } from '@/app/components/ui/button'
import { Avatar } from '@/app/components/ui/avatar'
import { Card, cardClassName } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { PageShell, TopBar } from '@/app/components/ui/shell'
import {
  notificationText,
  formatDate,
  type NotificationPayload,
} from '@/app/notifications/labels'
import { projectStatusLabel, roleLabel } from '@/app/projects/labels'

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
    <PageShell
      width="wide"
      footer={<ProcessPhasesFooter />}
      header={
        <TopBar className="justify-end">
          <Link
            href="/profile"
            title="Editar meu perfil"
            className="flex items-center gap-2.5 rounded-control p-0.5 text-inherit transition-colors hover:bg-canvas"
          >
            <Avatar src={avatarUrl} fallback={initial} />
            <span className="flex flex-col leading-[1.2]">
              <span className="text-sm font-semibold text-ink-soft">{displayName}</span>
              <span className="text-xs text-muted">{email}</span>
            </span>
          </Link>
          <NotificationBell items={inboxItems} />
          <form action={signOut} className="contents">
            <SubmitButton variant="ghost" pendingText="Saindo…">
              <svg
                className="h-4 w-4"
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
        </TopBar>
      }
    >
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="m-0 text-lg font-bold text-ink">Meus projetos</h1>
          <div className="flex items-center gap-3">
            {superAdmin ? (
              <ButtonLink href="/admin/permissions" variant="quiet">
                Solicitações de permissão
              </ButtonLink>
            ) : null}
            {hasArchived ? (
              <ButtonLink
                href={showArchived ? '/dashboard' : '/dashboard?arquivados=1'}
                variant="quiet"
              >
                {showArchived ? 'Ocultar arquivados' : 'Mostrar arquivados'}
              </ButtonLink>
            ) : null}
            <ButtonLink href="/projects/new" size="sm" className="whitespace-nowrap">
              + Novo projeto
            </ButtonLink>
          </div>
        </div>

        {!hasProjects ? (
          <EmptyState>
            Você ainda não participa de nenhum projeto. Crie o primeiro para começar.
          </EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={cardClassName({
                    interactive: true,
                    className: 'flex items-center justify-between gap-3 text-inherit',
                  })}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[15px] font-semibold text-ink">{p.name}</span>
                    <span className="text-xs text-muted">
                      {p.roles.map(roleLabel).join(' · ')}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
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
                <Card tone="accent" className="flex items-center justify-between gap-3">
                  <Link
                    href={`/projects/${inv.projectId}`}
                    className="group flex min-w-0 flex-col gap-1 text-inherit"
                  >
                    <span className="text-[15px] font-semibold text-ink transition-colors group-hover:text-brand">
                      {inv.projectName}
                    </span>
                    <span className="text-xs text-muted">
                      Convidado por {inv.inviterName ?? 'um administrador'} ·{' '}
                      {formatDate(inv.createdAt)}
                    </span>
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone="accent">convite pendente</Badge>
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
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProcessOverview
        createAction={
          <ButtonLink href="/projects/new" fullWidth>
            Criar Novo Projeto
          </ButtonLink>
        }
        joinAction={
          <Button variant="secondary" fullWidth>
            Entrar no Projeto
          </Button>
        }
      />
    </PageShell>
  )
}
