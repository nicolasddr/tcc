import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { withUser, profiles } from '@/lib/db'
import { NewProjectForm } from './new-project-form'
import '../projects.css'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // A criação é gated pela RLS (can_create_projects). A fatia 08 entrega o fluxo de
  // pedir permissão; aqui só avisamos quando o usuário ainda não tem. Leitura
  // RLS-aware (profiles_select_own só devolve a própria linha) — ver ADR 0007.
  const [profile] = await withUser(user.id, (tx) =>
    tx
      .select({ canCreateProjects: profiles.canCreateProjects })
      .from(profiles)
      .where(eq(profiles.id, user.id))
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
