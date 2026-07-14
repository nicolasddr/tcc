import Link from '@/app/components/app-link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { transaction, profiles } from '@/lib/db'
import { ProfileForm } from './profile-form'
import '../projects/projects.css'

export default async function ProfilePage() {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  // Leitura com escopo "own" explícito: o WHERE filtra pela própria linha (id = userId).
  const [profile] = await transaction((tx) =>
    tx
      .select({ name: profiles.name, email: profiles.email })
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
          <h1 className="project-page-title">Meu perfil</h1>
          <p className="project-page-subtitle">
            {profile?.email} — o nome aparece para os demais membros dos seus projetos.
          </p>

          <ProfileForm initialName={profile?.name ?? ''} />
        </div>
      </main>
    </div>
  )
}
