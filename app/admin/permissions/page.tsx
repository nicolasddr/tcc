import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { isSuperAdmin, listPendingPermissionRequests } from '@/lib/authz'
import { formatDate } from '@/app/notifications/labels'
import { SubmitButton } from '@/app/components/submit-button'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'
import { approvePermissionRequest, rejectPermissionRequest } from '@/app/admin/actions'

export default async function AdminPermissionsPage() {
  const userId = await requireUserId()
  if (!(await isSuperAdmin(userId))) redirect('/dashboard')

  const requests = await listPendingPermissionRequests()

  return (
    <PageShell
      header={
        <TopBar>
          <BackLink href="/dashboard" />
        </TopBar>
      }
    >
      <PageTitle>Solicitações de permissão</PageTitle>
      <PageSubtitle>
        Pedidos de usuários para poder criar projetos. Aprovar concede a permissão de
        imediato e notifica o solicitante.
      </PageSubtitle>

      {requests.length === 0 ? (
        <EmptyState>Nenhuma solicitação pendente.</EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {requests.map((req) => (
            <li key={req.requestId}>
              <Card padding="sm" className="flex items-center justify-between gap-4">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{req.userName}</span>
                  <span className="text-xs text-muted">
                    {req.userEmail} · solicitado em {formatDate(req.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <form action={approvePermissionRequest}>
                    <input type="hidden" name="request_id" value={req.requestId} />
                    <SubmitButton variant="primary" size="sm" pendingText="Aprovando…">
                      Aprovar
                    </SubmitButton>
                  </form>
                  <form action={rejectPermissionRequest}>
                    <input type="hidden" name="request_id" value={req.requestId} />
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
    </PageShell>
  )
}
