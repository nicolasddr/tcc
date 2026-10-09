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
import { Phase2Checklist } from '../pipeline/phase-2-checklist'
import { Phase3Checklist } from '../pipeline/phase-3-checklist'
import { Phase4Return } from '../pipeline/phase-4-return'
import type { LastClosedRound } from '../pipeline/last-round-summary'
import {
  EMPTY_PIPELINE,
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
  type PipelineInputs,
  type Phase2Inputs,
  type ReturnInputs,
} from '../pipeline/preconditions'
import { loadCodebook } from '../pipeline/codebook'
import { loadPrompt } from '../pipeline/prompt'
import { countItems } from '../pipeline/items'
import { FROZEN_BADGE_HELP, FROZEN_BADGE_LABEL } from '../pipeline/freeze'
import {
  listRounds,
  isOpen,
  focusRoundOf,
  roundsInPhase,
  type RoundSummary,
} from './rounds/rounds'
import {
  lastClosedPhase4RoundOfPassage,
  projectReferenceRound,
  referenceRoundOf,
  referenceVersionsOf,
} from './rounds/reference-round'
import { referenceComparison } from './rounds/reference-comparison'
import { ReferenceComparisonPanel } from './rounds/reference-comparison-panel'
import { loadProjectObservations, type RoundObservation } from './rounds/agreement'
import { loadProjectOutliers } from './rounds/outliers'
import { agreementSeries } from './rounds/agreement-series'
import { agreementPair, type AgreementPair } from './rounds/agreement-pair'
import { AgreementSeriesChart } from './rounds/agreement-series-chart'
import { hasQuality, qualityPair, type QualityPair } from './rounds/quality'
import {
  QUALITY_HELP,
  QUALITY_HINT,
  QUALITY_SERIES_HELP,
  QUALITY_SERIES_HINT,
} from './rounds/quality-labels'
import { QualityPanel } from './rounds/quality-panel'
import { qualitySeries } from './rounds/quality-series'
import { QualitySeriesList } from './rounds/quality-series-list'
import { SubmitButton } from '@/app/components/submit-button'
import { ButtonLink } from '@/app/components/ui/button'
import { Callout } from '@/app/components/ui/panel'
import { Badge } from '@/app/components/ui/badge'
import { cardClassName } from '@/app/components/ui/card'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { OpenLink } from '@/app/components/ui/open-link'
import { StatCard } from '@/app/components/ui/stat'
import { Disclosure } from '@/app/components/ui/disclosure'
import { Section } from '@/app/components/ui/section'

type AgreementData = {
  rounds: readonly RoundSummary[]
  observations: ReadonlyMap<string, RoundObservation[]>
  outliers: ReadonlyMap<string, Set<string>>
}

function roundCycleInputs(rounds: readonly RoundSummary[], phase: number): Phase2Inputs {
  const inPhase = roundsInPhase(rounds, phase)
  return {
    openRoundNumber: inPhase.find(isOpen)?.roundNumber ?? null,
    closedRounds: inPhase.filter((round) => !isOpen(round)).length,
  }
}

function lastClosedRoundOf(
  agreement: AgreementData,
  round: RoundSummary | undefined | null,
): LastClosedRound | null {
  if (!round) return null

  const observations = agreement.observations.get(round.id) ?? []
  const excluded = agreement.outliers.get(round.id) ?? new Set<string>()
  return {
    roundNumber: round.roundNumber,
    closedAt: round.closedAt,
    pair: agreementPair(observations, excluded),
    quality: hasQuality(round.phase) ? qualityPair(observations, excluded) : undefined,
  }
}

function phase2ChecklistData(agreement: AgreementData) {
  const closed = roundsInPhase(agreement.rounds, PHASE_2).filter((round) => !isOpen(round))
  return {
    inputs: roundCycleInputs(agreement.rounds, PHASE_2),
    lastRound: lastClosedRoundOf(agreement, closed[closed.length - 1]),
  }
}

function phase3ChecklistData(
  agreement: AgreementData,
  current: { codebook: number | null; prompt: number | null },
) {
  return {
    inputs: {
      ...roundCycleInputs(agreement.rounds, PHASE_3),
      versions: referenceVersionsOf(agreement.rounds, current),
    },
    lastRound: lastClosedRoundOf(agreement, projectReferenceRound(agreement.rounds)),
  }
}

function phase4ReturnData(agreement: AgreementData) {
  const inputs: ReturnInputs = {
    openRoundNumber: agreement.rounds.find(isOpen)?.roundNumber ?? null,
  }

  const round = lastClosedPhase4RoundOfPassage(agreement.rounds)
  if (!round) return { inputs, summary: null }

  const compared = [round, referenceRoundOf(agreement.rounds, round)].filter(
    (candidate): candidate is RoundSummary => candidate !== null,
  )
  const pairs = new Map<string, AgreementPair>()
  const qualities = new Map<string, QualityPair>()
  for (const candidate of compared) {
    const observations = agreement.observations.get(candidate.id) ?? []
    const excluded = agreement.outliers.get(candidate.id) ?? new Set<string>()
    pairs.set(candidate.id, agreementPair(observations, excluded))
    if (hasQuality(candidate.phase)) {
      qualities.set(candidate.id, qualityPair(observations, excluded))
    }
  }

  const comparison = referenceComparison(agreement.rounds, round, pairs, qualities)
  if (comparison.kind === 'not_phase_4') return { inputs, summary: null }

  return {
    inputs,
    summary: (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[13px] font-semibold text-ink">
          Última rodada fechada da Fase {PHASE_4}, ao lado da sua rodada de referência
        </p>
        <ReferenceComparisonPanel roundNumber={round.roundNumber} comparison={comparison} />
      </div>
    ),
  }
}

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
    const memberRows = viewerIsAdmin
      ? await listProjectMembers(
          userId,
          id,
          { isAdmin: viewerIsAdmin, isActive: viewerIsActive },
          tx,
        )
      : []

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
    : []

  const focus = agreement ? focusRoundOf(agreement.rounds) : null
  const focusQuality =
    agreement && focus && hasQuality(focus.phase)
      ? qualityPair(
          agreement.observations.get(focus.id) ?? [],
          agreement.outliers.get(focus.id) ?? new Set(),
        )
      : null

  const qualityPoints = agreement
    ? qualitySeries(agreement.rounds, agreement.observations, agreement.outliers)
    : []

  const phase2 = agreement ? phase2ChecklistData(agreement) : null
  const phase3 =
    agreement && artifacts
      ? phase3ChecklistData(agreement, {
          codebook: artifacts.codebook.version?.versionNumber ?? null,
          prompt: artifacts.prompt.version?.versionNumber ?? null,
        })
      : null
  const phase4 =
    agreement && artifacts && project.phase === PHASE_4 ? phase4ReturnData(agreement) : null

  const phase1Inputs: PipelineInputs | null = artifacts
    ? {
        ...EMPTY_PIPELINE,
        definitions: artifacts.codebook.definitions.length,
        promptText: artifacts.prompt.version?.text ?? null,
        items: artifacts.items,
      }
    : null

  const completedClassName = cardClassName({ padding: 'lg', className: 'mt-3' })
  const checklists = phase1Inputs
    ? [
        <PipelineChecklist
          key="phase-1"
          className={project.phase > PHASE_1 ? completedClassName : undefined}
          projectId={project.id}
          phase={project.phase}
          inputs={phase1Inputs}
        />,
        phase2 && project.phase >= PHASE_2 ? (
          <Phase2Checklist
            key="phase-2"
            className={project.phase > PHASE_2 ? completedClassName : undefined}
            projectId={project.id}
            phase={project.phase}
            inputs={phase2.inputs}
            lastRound={phase2.lastRound}
          />
        ) : null,
        phase3 && project.phase >= PHASE_3 ? (
          <Phase3Checklist
            key="phase-3"
            className={project.phase > PHASE_3 ? completedClassName : undefined}
            projectId={project.id}
            phase={project.phase}
            inputs={phase3.inputs}
            lastRound={phase3.lastRound}
          />
        ) : null,
      ].filter((checklist) => checklist !== null)
    : []
  const currentChecklist = phase4 ? null : (checklists.at(-1) ?? null)
  const completedChecklists = phase4 ? checklists : checklists.slice(0, -1)

  const canSteerPhase = isAdmin && project.status === 'active'

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
            badge={
              canSteerPhase && project.phase === PHASE_4 ? (
                <span className="inline-flex items-center gap-2">
                  <Badge>{FROZEN_BADGE_LABEL}</Badge>
                  <InfoTooltip text={FROZEN_BADGE_HELP} />
                </span>
              ) : null
            }
            action={
              canSteerPhase && project.phase === PHASE_4 ? (
                <ButtonLink href="#voltar" variant="secondary">
                  Voltar à Fase {PHASE_3}
                </ButtonLink>
              ) : canLeave ? (
                <ButtonLink href={`/projects/${project.id}/evaluate`}>Ir para Avaliar</ButtonLink>
              ) : null
            }
          >
            {currentChecklist ? (
              <div id="avancar" className="scroll-mt-6">
                {currentChecklist}
              </div>
            ) : null}
          </PhaseBar>

          {phase4 ? (
            <div id="voltar" className="scroll-mt-6">
              <Phase4Return
                className="mt-3"
                projectId={project.id}
                inputs={phase4.inputs}
                summary={phase4.summary}
              />
            </div>
          ) : null}

          {artifacts && project.phase > PHASE_1 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Avaliadores"
                value={activeEvaluators}
                hint={
                  inOnboarding > 0 ? `${inOnboarding} em onboarding` : 'ativos no projeto'
                }
              />

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

          {series.length > 0 ? (
            <Section
              title="Concordância por rodada"
              hint="Um ponto por rodada, em ordem cronológica."
              help="Cada ponto traz a versão de codebook que a rodada fixou e a fase em que ela foi aberta. As Fases 2, 3 e 4 ficam na mesma série. Da última rodada da Fase 2 para a primeira da Fase 3 com a mesma versão de codebook, a diferença mostra o efeito de a LLM passar a receber o codebook. Na Fase 3, o codebook refinado entre rodadas deve aparecer como concordância maior na rodada seguinte. Na Fase 4, codebook e prompt não mudam: o que muda são os itens e os avaliadores, e cada rodada se lê ao lado da sua rodada de referência."
            >
              <AgreementSeriesChart points={series} />
            </Section>
          ) : null}

          {focus && focusQuality ? (
            <Section
              title={
                focus.closedAt
                  ? `Qualidade na rodada ${focus.roundNumber}, fechada`
                  : `Qualidade na rodada ${focus.roundNumber}`
              }
              hint={QUALITY_HINT}
              help={QUALITY_HELP}
            >
              <QualityPanel pair={focusQuality} />
            </Section>
          ) : null}

          {qualityPoints.length > 1 ? (
            <Section
              title="Qualidade por rodada"
              hint={QUALITY_SERIES_HINT}
              help={QUALITY_SERIES_HELP}
            >
              <QualitySeriesList points={qualityPoints} />
            </Section>
          ) : null}

          {series.length > 0 ? (
            <p className="m-0 mt-4 text-xs">
              <OpenLink href={`/projects/${project.id}/rounds`}>Abrir rodadas →</OpenLink>
            </p>
          ) : null}

          {completedChecklists.length > 0 ? (
            <Disclosure
              className="mt-4"
              summary={`Fases concluídas (${completedChecklists.length})`}
            >
              {completedChecklists}
            </Disclosure>
          ) : null}
        </>
      ) : null}

      {/* HU-022: um avaliador ativo (não-admin) pode sair voluntariamente. */}
      {canLeave ? (
        <Section
          title="Sair do projeto"
          hint="Você deixa de participar como avaliador."
          help="Suas avaliações são preservadas, mas só o administrador poderá readmiti-lo depois."
        >
          <LeaveProjectButton projectId={project.id} />
        </Section>
      ) : null}
    </>
  )
}
