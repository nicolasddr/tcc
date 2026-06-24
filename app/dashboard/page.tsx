import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'
import { ProcessOverview, ProcessPhasesFooter } from '@/app/components/process-overview'
import { projectStatusLabel, roleLabel } from '@/app/projects/labels'
import './dashboard.css'
import '@/app/projects/projects.css'

type MembershipRow = {
  role: string
  status: string
  project: {
    id: string
    name: string
    status: string
  } | null
}

type ListedProject = {
  id: string
  name: string
  status: string
  roles: string[]
  onboardingPending: boolean
}

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture
  const email = user.email ?? ''
  const initial = email.charAt(0)

  // HU-013: projetos em que o usuário é membro (Administrador ou Avaliador), com
  // papéis agregados por projeto. O admin-avaliador tem duas linhas; agregamos aqui.
  const { data: membershipData } = await supabase
    .from('project_members')
    .select('role, status, project:projects(id, name, status)')
    .eq('user_id', user.id)

  const rows = (membershipData ?? []) as unknown as MembershipRow[]
  const byProject = new Map<string, ListedProject>()
  for (const row of rows) {
    const p = row.project
    if (!p) continue
    if (p.status === 'archived') continue // arquivados ocultos por padrão
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-user">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="dashboard-avatar" src={avatarUrl} alt="" />
          ) : (
            <span className="dashboard-avatar-fallback">{initial}</span>
          )}
          <span className="dashboard-email">{email}</span>
        </div>
        <form action={signOut} className="dashboard-logout-form">
          <button type="submit" className="dashboard-logout">
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
          </button>
        </form>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <section className="projects-section">
            <div className="projects-section-head">
              <h1 className="projects-title">Meus projetos</h1>
              <Link href="/projects/new" className="btn-new-project">
                + Novo projeto
              </Link>
            </div>

            {projects.length === 0 ? (
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
                          <span className="onboarding-badge">onboarding pendente</span>
                        ) : null}
                        <span className={`status-badge status-${p.status}`}>
                          {projectStatusLabel(p.status)}
                        </span>
                      </span>
                    </Link>
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
