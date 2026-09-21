import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers, projectInvitations } from '@/lib/db'
import { listProjectMembers } from '@/lib/authz'
import { acceptInvitation } from '@/app/onboarding/actions'
import { declineInvitation } from '@/app/invitations/actions'
import { groupMembers } from '../../members'
import { LeaveProjectButton } from '../member-actions'
import { PhaseBar } from '../phase-bar'
import { PipelineChecklist } from '../pipeline/pipeline-checklist'
import {
  Phase2Checklist,
  type LastClosedRound,
} from '../pipeline/phase-2-checklist'
import { EMPTY_PIPELINE, PHASE_1, PHASE_2 } from '../pipeline/preconditions'
import { loadCodebook } from '../pipeline/codebook'
import { loadPrompt } from '../pipeline/prompt'
import { countItems } from '../pipeline/items'
import { listRounds, isOpen } from './rounds/rounds'
import { loadProjectObservations } from './rounds/agreement'
import { loadProjectOutliers } from './rounds/outliers'
import { agreementSeries } from './rounds/agreement-series'
import { agreementPair } from './rounds/agreement-pair'
import { AgreementSeriesChart } from './rounds/agreement-series-chart'
import { SubmitButton } from '@/app/components/submit-button'
import { ButtonLink } from '@/app/components/ui/button'
import { Callout } from '@/app/components/ui/panel'
import { OpenLink } from '@/app/components/ui/open-link'
import { StatCard } from '@/app/components/ui/stat'
import { Section } from '@/app/components/ui/section'
import { ArrowRightIcon } from '@/app/components/ui/icons'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()


  const { project, memberships, pendingInvitation, memberRows, artifacts, agreement } = await transaction(async (tx) => {
    const [project] = await tx
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        phase: projects.phase,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    const memberships = await tx
      .select({ role: projectMembers.role, status: projectMembers.status })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)))

    const [pendingInvitation] = await tx
      .select({ id: projectInvitations.id })
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.projectId, id),
          eq(projectInvitations.inviteeId, userId),
          eq(projectInvitations.status, 'pending'),
        ),
      )
      .limit(1)

    const viewerIsAdmin = memberships.some(
      (m) => m.role === 'administrator' && m.status === 'active',
    )
    const viewerIsActive = memberships.some((m) => m.status === 'active')
    const memberRows = await listProjectMembers(
      userId,
      id,
      { isAdmin: viewerIsAdmin, isActive: viewerIsActive },
      tx,
    )

    const artifacts = viewerIsAdmin
      ? {
          codebook: await loadCodebook(id, tx),
          prompt: await loadPrompt(id, tx),
          items: await countItems(id, tx),
        }
      : null

    const agreement = viewerIsAdmin
      ? {
          rounds: await listRounds(id, tx),
          observations: await loadProjectObservations(id, tx),
          outliers: await loadProjectOutliers(id, tx),
        }
      : null

    return {
      project,
      memberships,
      pendingInvitation,
      memberRows,
      artifacts,
      agreement,
    }
  })
  if (!project) notFound()

  const canView =
    project.createdBy === userId ||
    memberships.length > 0 ||
    Boolean(pendingInvitation)
  if (!canView) notFound()

  const onboardingPending = memberships.some(
    (m) => m.role === 'evaluator' && m.status === 'pending_onboarding',
  )
  // Só o Administrador ativo convida avaliadores.
  const isAdmin = memberships.some(
    (m) => m.role === 'administrator' && m.status === 'active',
  )
  const isMember = memberships.length > 0

  const canLeave =
    !isAdmin && memberships.some((m) => m.role === 'evaluator' && m.status === 'active')

  const series = agreement
    ? agreementSeries(agreement.rounds, agreement.observations, agreement.outliers)
    : null

  const closed = agreement ? agreement.rounds.filter((round) => !isOpen(round)) : []
  const latest = closed[closed.length - 1]
  const lastRound: LastClosedRound | null =
    agreement && latest
      ? {
          roundNumber: latest.roundNumber,
          closedAt: latest.closedAt,
          pair: agreementPair(
            agreement.observations.get(latest.id) ?? [],
            agreement.outliers.get(latest.id) ?? new Set(),
          ),
        }
      : null

  const members = groupMembers(memberRows)
  const activeEvaluators = members.filter(
    (m) => m.roles.includes('evaluator') && m.status === 'active',
  ).length
  const inOnboarding = members.filter((m) => m.status === 'pending_onboarding').length

  return (
    <>
      {/* Convite pendente: o convidado (ainda não-membro) aceita ou recusa aqui. */}
      {pendingInvitation && !isMember ? (
        <Callout
          className="mt-6"
          tone="accent"
          title="Você foi convidado para este projeto"
          hint="Ao aceitar, você passa por um onboarding rápido (consentimento) antes de participar como avaliador."
          action={
            <>
              <form action={acceptInvitation}>
                <input type="hidden" name="project_id" value={project.id} />
                <SubmitButton variant="primary" pendingText="Aceitando…">
                  Aceitar convite
                </SubmitButton>
              </form>
              <form action={declineInvitation}>
                <input type="hidden" name="invitation_id" value={pendingInvitation.id} />
                <SubmitButton variant="danger" pendingText="Recusando…">
                  Recusar
                </SubmitButton>
              </form>
            </>
          }
        />
      ) : null}

      {/* Onboarding a concluir: já aceitou, falta consentir. */}
      {onboardingPending ? (
        <Callout
          className="mt-6"
          tone="accent"
          title="Conclua seu onboarding"
          hint="Falta registrar o consentimento e responder o questionário de perfil para ativar sua participação como avaliador."
          action={
            <ButtonLink href={`/projects/${project.id}/onboarding`}>
              Concluir onboarding
            </ButtonLink>
          }
        />
      ) : null}

      {isMember ? (
        <>
          <PhaseBar
            className="mt-4"
            current={project.phase}
            action={
              isAdmin &&
              project.status === 'active' &&
              (project.phase === PHASE_1 || project.phase === PHASE_2) ? (
                <ButtonLink href="#avancar">
                  Avançar fase
                  <ArrowRightIcon />
                </ButtonLink>
              ) : null
            }
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Avaliadores"
              value={activeEvaluators}
              hint={
                inOnboarding > 0 ? `${inOnboarding} em onboarding` : 'ativos no projeto'
              }
            />
          </div>

          {artifacts ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Codebook"
                value={artifacts.codebook.definitions.length}
                suffix={
                  artifacts.codebook.definitions.length === 1
                    ? 'definição'
                    : 'definições'
                }
                hint={
                  <>
                    {artifacts.codebook.version
                      ? `Versão ${artifacts.codebook.version.versionNumber} vigente · `
                      : 'Nenhuma versão ainda · '}
                    <OpenLink href={`/projects/${project.id}/codebook`}>
                      Abrir codebook
                    </OpenLink>
                  </>
                }
              />

              <StatCard
                label="Prompt"
                value={
                  artifacts.prompt.version
                    ? `v${artifacts.prompt.version.versionNumber}`
                    : '—'
                }
                suffix={artifacts.prompt.version ? 'vigente' : undefined}
                hint={
                  <>
                    {artifacts.prompt.version?.name
                      ? `${artifacts.prompt.version.name} · `
                      : artifacts.prompt.version
                        ? 'Sem nome · '
                        : 'Nenhuma versão ainda · '}
                    <OpenLink href={`/projects/${project.id}/prompt`}>
                      Abrir prompt
                    </OpenLink>
                  </>
                }
              />

              <StatCard
                label="Itens de entrada"
                value={artifacts.items}
                suffix="no pool"
                hint={
                  <OpenLink href={`/projects/${project.id}/items`}>Abrir itens</OpenLink>
                }
              />
            </div>
          ) : null}

          {series ? (
            <Section
              title="Concordância por rodada"
              hint="Um ponto por rodada, em ordem cronológica, com a versão de codebook que cada uma fixou. A curva é a leitura da fase: o codebook refinado entre rodadas deve aparecer aqui como concordância maior na rodada seguinte."
            >
              <AgreementSeriesChart points={series} projectId={project.id} />
            </Section>
          ) : null}

          {artifacts ? (
            <div id="avancar" className="scroll-mt-6">
              <PipelineChecklist
                className="mt-3"
                projectId={project.id}
                phase={project.phase}
                inputs={{
                  ...EMPTY_PIPELINE,
                  definitions: artifacts.codebook.definitions.length,
                  promptText: artifacts.prompt.version?.text ?? null,
                  items: artifacts.items,
                }}
              />

              {agreement && project.phase >= PHASE_2 ? (
                <Phase2Checklist
                  className="mt-3"
                  projectId={project.id}
                  phase={project.phase}
                  inputs={{
                    openRoundNumber:
                      agreement.rounds.find(isOpen)?.roundNumber ?? null,
                    closedRounds: closed.length,
                  }}
                  lastRound={lastRound}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {/* HU-022: um avaliador ativo (não-admin) pode sair voluntariamente. */}
      {canLeave ? (
        <Section
          title="Sair do projeto"
          hint="Você deixa de participar como avaliador. Suas avaliações são preservadas, mas só o administrador poderá readmiti-lo depois."
        >
          <LeaveProjectButton projectId={project.id} />
        </Section>
      ) : null}
    </>
  )
}
