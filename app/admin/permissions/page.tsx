import Link from '@/app/components/app-link'
import { redirect } from 'next/navigation'
import { getClaims } from '@/lib/supabase/server'
import { isSuperAdmin, listPendingPermissionRequests } from '@/lib/authz'
import { formatDate } from '@/app/notifications/labels'
import { SubmitButton } from '@/app/components/submit-button'
import { approvePermissionRequest, rejectPermissionRequest } from '@/app/admin/actions'
import '../../projects/projects.css'

// Fatia 08 (#33): revisão das solicitações de permissão de criar projetos. Página restrita
// ao super-admin — a checagem é EXPLÍCITA aqui (`isSuperAdmin`); quem não for é mandado ao
// dashboard (não revelamos a existência da página). A fila mostra as pendentes (mais antiga
// primeiro) com Aprovar/Recusar; ambos são Server Actions (ver app/admin/actions.ts).
export default async function AdminPermissionsPage() {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  if (!(await isSuperAdmin(claims.sub))) redirect('/dashboard')

  const requests = await listPendingPermissionRequests()

  return (
    <div className="project-page">
      <header className="project-topbar">
        <Link href="/dashboard" className="project-back">
          ← Voltar
        </Link>
      </header>

      <main className="project-main">
        <div className="project-narrow">
          <h1 className="project-page-title">Solicitações de permissão</h1>
          <p className="project-page-subtitle">
            Pedidos de usuários para poder criar projetos. Aprovar concede a permissão de
            imediato e notifica o solicitante.
          </p>

          {requests.length === 0 ? (
            <p className="projects-empty">Nenhuma solicitação pendente.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {requests.map((req) => (
                <li
                  key={req.requestId}
                  className="flex items-center justify-between gap-4 rounded-control border border-line px-4 py-3"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">{req.userName}</span>
                    <span className="text-xs text-muted">
                      {req.userEmail} · solicitado em {formatDate(req.createdAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
