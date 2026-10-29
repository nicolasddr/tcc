import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers, type DbExecutor } from '@/lib/db'
import { countSubmittedEvaluations, listProjectMembers } from '@/lib/authz'
import { groupMembers, participationByUser } from '../../../members'
import { evaluatorLinkOf } from '../../../evaluator-link'
import { listEvaluatorEffort } from '../rounds/agreement'
import { loadOutlierHistory, loadRoundOutliers } from '../rounds/outliers'
import { loadEvaluatorParticipation } from '../rounds/participation'
import { listRoundsWithEvaluations } from '../rounds/rounds'
import { MemberList } from '../../member-list'
import { EvaluatorRolePanel } from '../../evaluator-role'
import { InviteEvaluatorForm } from '../../invite-evaluator-form'
import { OutlierPanel, type OutlierPanelData } from './outlier-panel'
import { TEAM_MORE } from './team-help'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Section } from '@/app/components/ui/section'

const EMPTY_OUTLIERS: OutlierPanelData = {
  rounds: [],
  round: null,
  effort: [],
  marks: [],
  history: [],
}

async function loadOutlierPanel(
  projectId: string,
  requested: string | null,
  tx: DbExecutor,
): Promise<OutlierPanelData> {
  const rounds = await listRoundsWithEvaluations(projectId, tx)
  const round = rounds.find((option) => option.id === requested) ?? rounds[0] ?? null
  if (!round) return { ...EMPTY_OUTLIERS, rounds }

  return {
    rounds,
    round,
    effort: await listEvaluatorEffort(round.id, projectId, tx),
    marks: await loadRoundOutliers(round.id, tx),
    history: await loadOutlierHistory(round.id, tx),
  }
}

export default async function ProjectMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ round?: string }>
}) {
  const { id } = await params
  const requestedRound = (await searchParams).round ?? null
  const userId = await requireUserId()

  const { project, isAdmin, isActive, evaluatorLink, memberRows, participation, outliers } =
    await transaction(async (tx) => {
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

      const submittedEvaluations = await countSubmittedEvaluations(userId, id, tx)

      return {
        project,
        isAdmin,
        isActive,
        evaluatorLink: evaluatorLinkOf(memberships, submittedEvaluations),
        memberRows,
        participation:
          project && isAdmin
            ? participationByUser(memberRows, await loadEvaluatorParticipation(id, tx))
            : undefined,
        outliers:
          project && isAdmin
            ? await loadOutlierPanel(id, requestedRound, tx)
            : EMPTY_OUTLIERS,
      }
    })

  if (!project || !isActive) notFound()

  const members = groupMembers(memberRows)

  return (
    <div className="max-w-3xl">
      {isAdmin ? (
        <Section
          title="Convidar avaliador"
          hint="O convidado recebe uma notificação e entra no projeto depois do onboarding."
        >
          <InviteEvaluatorForm projectId={project.id} />
        </Section>
      ) : null}

      <Section
        title="Membros do projeto"
        more={isAdmin ? TEAM_MORE : undefined}
      >
        {members.length > 0 ? (
          <MemberList
            projectId={project.id}
            members={members}
            viewerId={userId}
            canManage={isAdmin}
            participation={participation}
          />
        ) : (
          <EmptyState>Nenhum membro para mostrar.</EmptyState>
        )}
      </Section>

      {isAdmin ? (
        <Section
          title="Outliers por rodada"
          hint="Marcar uma pessoa como outlier tira as notas dela do cálculo da concordância e da confiabilidade daquela rodada, e só daquela rodada."
          help="A marca não altera o acesso da pessoa ao projeto, não apaga nenhuma avaliação, e a ferramenta não avisa o avaliador."
        >
          <OutlierPanel projectId={project.id} {...outliers} />
        </Section>
      ) : null}

      {isAdmin ? (
        <Section
          title="Avaliar neste projeto"
          hint="Mesmo sendo Administrador, você também pode assumir o papel de Avaliador no projeto."
          help="O vínculo novo passa pelo mesmo consentimento e questionário de perfil dos demais. Para separar suas notas, marque-se como outlier na rodada."
        >
          <EvaluatorRolePanel
            projectId={project.id}
            view={{ isAdmin, link: evaluatorLink }}
          />
        </Section>
      ) : null}
    </div>
  )
}
