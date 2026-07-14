import Link from '@/app/components/app-link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { withUser, profiles } from '@/lib/db'
import { NewProjectForm } from './new-project-form'
import '../projects.css'

export default async function NewProjectPage() {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  // A criação exige can_create_projects (checada na app em createProject; ver issue #22).
  // A fatia 08 entrega o fluxo de pedir permissão; aqui só avisamos quando o usuário ainda
  // não tem. Leitura com escopo "own" explícito (só a própria linha de profile), com a RLS
  // profiles_select_own como backstop — ver ADR 0007.
  const [profile] = await withUser(userId, (tx) =>
    tx
      .select({ canCreateProjects: profiles.canCreateProjects })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1),
  )

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
          <p className="project-page-subtitle">
            Você se torna o Administrador deste projeto e pode convidar avaliadores depois.
          </p>

          {profile && !profile.canCreateProjects ? (
            <p className="form-notice" role="status">
              Sua conta ainda não tem permissão para criar projetos. Você pode preencher o
              formulário, mas a criação só será concluída após a permissão ser concedida.
            </p>
          ) : null}

          <NewProjectForm />
        </div>
      </main>
    </div>
  )
}
