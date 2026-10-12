import Link from '@/app/components/app-link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { transaction, projectMembers, projects as projectsTable } from '@/lib/db'
import { isSuperAdmin, listMyPendingInvitations, type PendingInvitation } from '@/lib/authz'
import { declineInvitation } from '@/app/invitations/actions'
import { acceptInvitation } from '@/app/onboarding/actions'
import { CollapsedProcessOverview, ProcessOverview } from '@/app/components/process-overview'
import { ProcessPhasesFooter } from '@/app/components/process-phases-footer'
import { AppTopBar } from '@/app/components/app-top-bar'
import { loadTopBar } from '@/app/components/app-top-bar-data'
import { SubmitButton } from '@/app/components/submit-button'
import { Badge, StatusBadge } from '@/app/components/ui/badge'
import { ButtonLink } from '@/app/components/ui/button'
import { Card, cardClassName } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { PageShell } from '@/app/components/ui/shell'
import { formatDate } from '@/app/notifications/labels'
import { memberStatusLabel, projectStatusLabel, roleLabel } from '@/app/projects/labels'
import { PROJECT_PHASES, TOTAL_PHASES } from '@/app/projects/[id]/phase-bar'

type ListedProject = {
  id: string
  name: string
  status: string
  phase: number
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
  void loadTopBar(userId)

  const membershipRows = await transaction((tx) =>
    tx
      .select({
        role: projectMembers.role,
        status: projectMembers.status,
        project: {
          id: projectsTable.id,
          name: projectsTable.name,
          status: projectsTable.status,
          phase: projectsTable.phase,
        },
      })
      .from(projectMembers)
      .innerJoin(projectsTable, eq(projectMembers.projectId, projectsTable.id))
      .where(eq(projectMembers.userId, userId)),
  )

  const pendingInvitationRows = await listMyPendingInvitations(userId)

  const superAdmin = await isSuperAdmin(userId)

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
      entry = {
        id: p.id,
        name: p.name,
        status: p.status,
        phase: p.phase,
        roles: [],
        onboardingPending: false,
      }
      byProject.set(p.id, entry)
    }
    if (!entry.roles.includes(row.role)) entry.roles.push(row.role)
    if (row.role === 'evaluator' && row.status === 'pending_onboarding') {
      entry.onboardingPending = true
    }
  }
  const projects = [...byProject.values()]

  const pendingInvitations: PendingInvitation[] = pendingInvitationRows

  const invitedProjects = pendingInvitations.filter((inv) => !byProject.has(inv.projectId))
  const hasProjects = projects.length > 0 || invitedProjects.length > 0

  return (
    <PageShell
      width="wide"
      footer={<ProcessPhasesFooter />}
      header={<AppTopBar trail={[{ label: 'Meus projetos' }]} />}
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
                      {[
                        ...p.roles.toSorted().map(roleLabel),
                        `Fase ${p.phase} de ${TOTAL_PHASES}, ${PROJECT_PHASES[p.phase - 1].name}`,
                      ].join(' · ')}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {p.onboardingPending ? (
                      <Badge tone="warning">{memberStatusLabel('pending_onboarding')}</Badge>
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
                    <Badge tone="accent">Convite pendente</Badge>
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

      {hasProjects ? (
        <CollapsedProcessOverview />
      ) : (
        <ProcessOverview
          createAction={
            <ButtonLink href="/projects/new" fullWidth>
              + Novo projeto
            </ButtonLink>
          }
        />
      )}
    </PageShell>
  )
}
