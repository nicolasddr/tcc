import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers } from '@/lib/db'
import { listProjectMembers } from '@/lib/authz'
import { groupMembers } from '../../members'
import { evaluatorLinkOf } from '../../evaluator-link'
import { MemberList } from '../member-list'
import { EvaluatorRolePanel } from '../evaluator-role'
import { InviteEvaluatorForm } from '../invite-evaluator-form'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { project, isAdmin, isActive, evaluatorLink, memberRows } = await transaction(async (tx) => {
    const [project] = await tx
      .select({ id: projects.id, name: projects.name })
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
    const isActive = memberships.some((m) => m.status === 'active')
    const memberRows = project
      ? await listProjectMembers(userId, id, { isAdmin, isActive }, tx)
      : []

    return { project, isAdmin, isActive, evaluatorLink: evaluatorLinkOf(memberships), memberRows }
  })

  if (!project || !isActive) notFound()

  const members = groupMembers(memberRows)

  return (
    <PageShell
      header={
        <TopBar>
          <BackLink href={`/projects/${id}`}>Voltar ao projeto</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Membros</PageTitle>
      <PageSubtitle>{project.name}</PageSubtitle>

      <Section
        divider={false}
        title="Equipe do projeto"
        hint={
          isAdmin
            ? 'Acompanhe quem participa, veja as respostas de onboarding e remova avaliadores.'
            : 'Quem participa do projeto e em que papel.'
        }
      >
        {members.length > 0 ? (
          <MemberList
            projectId={project.id}
            members={members}
            viewerId={userId}
            canManage={isAdmin}
          />
        ) : (
          <EmptyState>Nenhum membro para mostrar.</EmptyState>
        )}
      </Section>

      {isAdmin ? (
        <Section
          title="Convidar avaliador"
          hint="O convidado recebe uma notificação e entra no projeto depois do onboarding."
        >
          <InviteEvaluatorForm projectId={project.id} />
        </Section>
      ) : null}

      {isAdmin ? (
        <Section
          title="Avaliar neste projeto"
          hint="Como Administrador, você pode se dar também o papel de Avaliador. O vínculo novo passa pelo mesmo consentimento e pelo mesmo questionário de perfil dos demais avaliadores, e os painéis de concordância separam o Administrador-avaliador do restante da equipe."
        >
          <EvaluatorRolePanel
            projectId={project.id}
            view={{ isAdmin, link: evaluatorLink }}
          />
        </Section>
      ) : null}
    </PageShell>
  )
}
