import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { withUser, projects, projectMembers } from '@/lib/db'
import { CONSENT_TEXT } from '@/app/onboarding/consent'
import { ConsentForm } from './consent-form'
import '../../projects.css'
import '@/app/notifications/notifications.css'

// HU-028: passo de consentimento do onboarding do avaliador. Só faz sentido quando o
// usuário tem uma linha de avaliador em pending_onboarding (aceitou o convite mas ainda
// não consentiu). Se já está active (concluiu) ou não tem linha (não aceitou), volta
// para a página do projeto.
export default async function OnboardingPage({
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

  const { project, membership } = await withUser(user.id, async (tx) => {
    const [project] = await tx
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    const [membership] = await tx
      .select({ status: projectMembers.status })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, id),
          eq(projectMembers.userId, user.id),
          eq(projectMembers.role, 'evaluator'),
        ),
      )
      .limit(1)

    return { project, membership }
  })

  if (!project) notFound()
  if (!membership || membership.status !== 'pending_onboarding') {
    redirect(`/projects/${id}`)
  }

  return (
    <div className="project-page">
      <header className="project-topbar">
        <Link href={`/projects/${id}`} className="project-back">
          ← Voltar
        </Link>
      </header>

      <main className="project-main">
        <div className="project-narrow">
          <h1 className="project-page-title">Onboarding — {project.name}</h1>
          <p className="project-page-subtitle">
            Antes de participar como avaliador, leia e aceite o termo de consentimento.
          </p>
          <ConsentForm projectId={id} consentText={CONSENT_TEXT} />
        </div>
      </main>
    </div>
  )
}
