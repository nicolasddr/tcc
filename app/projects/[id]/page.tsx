import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { taskTypeLabel } from '../task-types'
import { projectStatusLabel, roleLabel } from '../labels'
import '../projects.css'

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

  // RLS só deixa membro/convidado enxergar o projeto; quem não participa recebe
  // null e cai no notFound (não distingue "não existe" de "sem acesso").
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, description, status, task_type, created_at')
    .eq('id', id)
    .single()
  if (!project) notFound()

  // Papéis do usuário neste projeto (uma linha por papel — HU-024).
  const { data: memberships } = await supabase
    .from('project_members')
    .select('role, status')
    .eq('project_id', id)
    .eq('user_id', user.id)

  const roles = (memberships ?? []).map((m) => roleLabel(m.role))
  const onboardingPending = (memberships ?? []).some(
    (m) => m.role === 'evaluator' && m.status === 'pending_onboarding',
  )
  const taskType = taskTypeLabel(project.task_type)

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
        </div>
      </main>
    </div>
  )
}
