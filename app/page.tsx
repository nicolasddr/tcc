import Link from '@/app/components/app-link'
import { redirect } from 'next/navigation'
import { getClaims } from '@/lib/supabase/server'
import { GoogleSignInButton, LoginButton } from './components/auth-buttons'
import { ProcessOverview } from './components/process-overview'
import { ProcessPhasesFooter } from './components/process-phases-footer'

export default async function Home() {
  const claims = await getClaims()
  if (claims) redirect('/dashboard')

  return (
    <div className="flex-1 bg-surface text-sm leading-[1.6] text-ink">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3">
        <Link className="flex items-center gap-2 text-[15px] font-bold text-brand" href="/">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[15px] text-white">
            ✦
          </span>
          Engenharia de Prompt
          <span className="text-xs font-normal text-muted">protótipo</span>
        </Link>
        <GoogleSignInButton />
      </header>

      <main className="mx-auto max-w-[960px] px-6 pb-20">
        <div className="pt-14 pb-10 text-center">
          <h1 className="mb-4 text-[34px] leading-[1.2] font-extrabold text-ink">
            Crie e valide prompts de forma sistemática
          </h1>
          <p className="mx-auto mb-7 max-w-[520px] text-base leading-[1.6] text-muted">
            Este protótipo implementa o processo proposto por Shah (2025) em{' '}
            <em>From Prompt Engineering to Prompt Science</em>, que visa tornar a
            engenharia de prompt mais verificável, replicável e livre de
            subjetividade individual.
          </p>
          <GoogleSignInButton />
        </div>

        <ProcessOverview
          createAction={<LoginButton fullWidth>Criar Novo Projeto</LoginButton>}
          joinAction={
            <LoginButton variant="secondary" fullWidth>
              Entrar no Projeto
            </LoginButton>
          }
        />
      </main>

      <ProcessPhasesFooter />
    </div>
  )
}
