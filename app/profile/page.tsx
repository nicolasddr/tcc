import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, profiles, projects, projectMembers } from '@/lib/db'
import { Card } from '@/app/components/ui/card'
import { BackLink, PageShell, PageTitle, PageSubtitle } from '@/app/components/ui/shell'
import { AppTopBar, type TrailItem } from '@/app/components/app-top-bar'
import { ProfileForm } from './profile-form'
import { projectIdOf, safeReturnPath } from './return-to'

const DASHBOARD: TrailItem = { label: 'Meus projetos', href: '/dashboard' }
const CURRENT: TrailItem = { label: 'Meu perfil' }

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const userId = await requireUserId()
  const from = safeReturnPath((await searchParams).from)
  const projectId = from ? projectIdOf(from) : null

  const { profile, project } = await transaction(async (tx) => {
    // Leitura com escopo "own" explícito: o WHERE filtra pela própria linha (id = userId).
    const [profile] = await tx
      .select({ name: profiles.name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)

    const [project] = projectId
      ? await tx
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .innerJoin(
            projectMembers,
            and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, userId)),
          )
          .where(eq(projects.id, projectId))
          .limit(1)
      : []

    return { profile, project }
  })

  let back: { href: string; label: string }
  let trail: TrailItem[]
  if (project && from) {
    back = { href: from, label: `Voltar ao projeto ${project.name}` }
    trail = [DASHBOARD, { label: project.name, href: `/projects/${project.id}` }, CURRENT]
  } else if (from?.startsWith('/admin/permissions')) {
    back = { href: from, label: 'Voltar às solicitações de permissão' }
    trail = [DASHBOARD, { label: 'Solicitações de permissão', href: '/admin/permissions' }, CURRENT]
  } else if (from && !from.startsWith('/dashboard')) {
    back = { href: from, label: 'Voltar à página anterior' }
    trail = [DASHBOARD, CURRENT]
  } else {
    back = { href: from ?? '/dashboard', label: 'Voltar a Meus projetos' }
    trail = [DASHBOARD, CURRENT]
  }

  return (
    <PageShell header={<AppTopBar trail={trail} />}>
      <div className="mb-4">
        <BackLink href={back.href}>{back.label}</BackLink>
      </div>

      <PageTitle>Meu perfil</PageTitle>
      <PageSubtitle>Email: {profile?.email}</PageSubtitle>

      <Card padding="lg">
        <ProfileForm initialName={profile?.name ?? ''} />
      </Card>
    </PageShell>
  )
}
