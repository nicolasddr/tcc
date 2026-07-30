import Link from '@/app/components/app-link'
import { requireUserId } from '@/lib/supabase/server'
import { canCreateProjects, hasPendingPermissionRequest } from '@/lib/authz'
import { NewProjectForm } from './new-project-form'
import { RequestPermissionForm } from './request-permission-form'
import '../projects.css'

export default async function NewProjectPage() {
  const userId = await requireUserId()

  const allowed = await canCreateProjects(userId)
  const pendingRequest = allowed ? false : await hasPendingPermissionRequest(userId)

  return (
    <div className="project-page">
      <header className="project-topbar">
        <Link href="/dashboard" className="project-back">
          ← Voltar
        </Link>
      </header>

      <main className="project-main">
        <div className="project-narrow">
          <h1 className="project-page-title">Criar novo projeto</h1>
          {allowed ? (
            <>
              <p className="project-page-subtitle">
                Você se torna o Administrador deste projeto e pode convidar avaliadores
                depois.
              </p>
              <NewProjectForm />
            </>
          ) : (
            <RequestPermissionForm alreadyPending={pendingRequest} />
          )}
        </div>
      </main>
    </div>
  )
}
