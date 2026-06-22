import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import './home.css'
import { GoogleSignInButton, LoginButton } from './components/auth-buttons'
import { ProcessOverview, ProcessPhasesFooter } from './components/process-overview'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="page">
      <header className="page-header">
        <a className="logo" href="/">
          <span className="logo-icon">✦</span>
          Engenharia de Prompt
          <span className="logo-badge">protótipo</span>
        </a>
        <GoogleSignInButton />
      </header>

      <main>
        <div className="hero">
          <h1>Crie e valide prompts de forma sistemática</h1>
          <p>
            Este protótipo implementa o processo proposto por Shah (2025) em{' '}
            <em>From Prompt Engineering to Prompt Science</em>, que visa tornar a
            engenharia de prompt mais verificável, replicável e livre de
            subjetividade individual.
          </p>
          <GoogleSignInButton />
        </div>

        <ProcessOverview
          createAction={<LoginButton className="btn-role-primary">Criar Novo Projeto</LoginButton>}
          joinAction={<LoginButton className="btn-role-outline">Entrar no Projeto</LoginButton>}
        />
      </main>

      <ProcessPhasesFooter />
    </div>
  )
}
