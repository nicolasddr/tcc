import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewProjectForm } from './new-project-form'
import '../projects.css'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // A criação é gated pela RLS (can_create_projects). A fatia 08 entrega o fluxo de
  // pedir permissão; aqui só avisamos quando o usuário ainda não tem.
  const { data: profile } = await supabase
    .from('profiles')
    .select('can_create_projects')
    .eq('id', user.id)
    .single()

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

          {profile && !profile.can_create_projects ? (
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
