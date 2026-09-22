import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers } from '@/lib/db'
import { formatDate } from '@/app/notifications/labels'
import { ManageProject } from '../manage-project'
import { ButtonLink } from '@/app/components/ui/button'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { project, isAdmin } = await transaction(async (tx) => {
    const [project] = await tx
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    const memberships = await tx
      .select({ role: projectMembers.role, status: projectMembers.status })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)))

    const isAdmin = memberships.some(
      (m) => m.role === 'administrator' && m.status === 'active',
    )

    return { project, isAdmin }
  })

  // Configurar o projeto é exclusivo do Administrador ativo: para qualquer outro
  // visitante a página não existe.
  if (!project || !isAdmin) notFound()

  return (
    <PageShell
      header={
        <TopBar>
          <BackLink href={`/projects/${id}`}>Voltar ao projeto</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Ajustes do projeto</PageTitle>
      <PageSubtitle className="mb-0">{project.name}</PageSubtitle>
      <p className="mt-1 mb-6 text-sm text-muted">
        Data de criação do projeto: {formatDate(project.createdAt)}
      </p>

      <Section
        divider={false}
        title="Onboarding dos avaliadores"
        hint="As perguntas que os avaliadores respondem ao entrar no projeto."
        help="Cada pergunta pode ser aberta ou de múltipla escolha, e todas são obrigatórias para o avaliador concluir o onboarding."
      >
        <ButtonLink href={`/projects/${id}/questions`} variant="secondary">
          Gerenciar perguntas de onboarding
        </ButtonLink>
      </Section>

      <Section
        title="Equipe do projeto"
        hint="Quem participa do projeto se gerencia na tela de Membros."
        help="É lá que se convida avaliador, se acompanha quem participa e se dá a si mesmo o papel de Avaliador."
      >
        <ButtonLink href={`/projects/${id}/members`} variant="secondary">
          Gerenciar membros
        </ButtonLink>
      </Section>

      {/* HU-014–017: editar nome/descrição e mover o projeto entre
          ativo / concluído / arquivado. */}
      <ManageProject
        projectId={project.id}
        status={project.status}
        name={project.name}
        description={project.description}
      />
    </PageShell>
  )
}
