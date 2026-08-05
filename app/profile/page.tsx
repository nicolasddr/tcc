import { eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, profiles } from '@/lib/db'
import { Card } from '@/app/components/ui/card'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const userId = await requireUserId()

  // Leitura com escopo "own" explícito: o WHERE filtra pela própria linha (id = userId).
  const [profile] = await transaction((tx) =>
    tx
      .select({ name: profiles.name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1),
  )

  return (
    <PageShell
      header={
        <TopBar>
          <BackLink href="/dashboard" />
        </TopBar>
      }
    >
      <PageTitle>Meu perfil</PageTitle>
      <PageSubtitle>
        {profile?.email} — o nome aparece para os demais membros dos seus projetos.
      </PageSubtitle>

      <Card padding="lg">
        <ProfileForm initialName={profile?.name ?? ''} />
      </Card>
    </PageShell>
  )
}
