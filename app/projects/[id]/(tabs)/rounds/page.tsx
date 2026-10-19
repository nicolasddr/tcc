import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadCodebook, loadCodebookVersion } from '../../pipeline/codebook'
import { loadPrompt } from '../../pipeline/prompt'
import { loadItems } from '../../pipeline/items'
import { listRoundResponses } from '../../pipeline/responses'
import { focusRoundOf, listRounds, loadOpenRound } from './rounds'
import { referenceVersionsOf } from './reference-round'
import {
  listEvaluatorEffort,
  loadProjectObservations,
  type RoundObservation,
} from './agreement'
import {
  agreementPair,
  evaluatedResponses,
  profilePair,
  withoutExcluded,
  type AgreementPair,
} from './agreement-pair'
import { loadProjectOutliers, loadRoundOutliers } from './outliers'
import { loadEvaluatorParticipation } from './participation'
import { participationBefore } from './participation-labels'
import { hasQuality, qualityPair, type QualityPair } from './quality'
import { QUALITY_HINT, QUALITY_POINTS } from './quality-labels'
import {
  evaluatorsNotFinished,
  isActiveEvaluator,
  roundBlockers,
  SELECTION_MAX,
} from './preconditions'
import { NewRound } from './new-round'
import { CloseRound } from './close-round'
import { GenerateResponses } from './generate-responses'
import { RoundList } from './round-list'
import { GENERATE_PANEL_ID, OpenRoundCard } from './open-round-card'
import { EvaluatorRounds } from './evaluator-rounds'
import { listReviewableRounds } from './review'
import { requireReviewAccess } from './review-access'
import { AgreementPanel } from './agreement-panel'
import { AgreementMatrixTable } from './agreement-matrix-table'
import { matrixColumns } from './agreement-matrix'
import { byDefinitionSummary } from './agreement-labels'
import { CriterionAgreementTable } from './criterion-agreement-table'
import { QualityPanel } from './quality-panel'
import { QualityMatrixNotes, QualityMatrixTable } from './quality-matrix-table'
import { CriterionQualityTable } from './criterion-quality-table'
import {
  QUALITY_SECTION_ID,
  hasReadingGuidance,
  readingGuidance,
} from './reading-guidance'
import { ReadingGuidanceNote } from './reading-guidance-note'
import {
  AGREEMENT_SECTION_ID,
  ROUNDS_SECTION_ID,
  ReadingShortcuts,
  readingShortcuts,
} from './reading-shortcuts'
import { referenceComparison } from './reference-comparison'
import {
  REFERENCE_COMPARISON_HELP,
  REFERENCE_COMPARISON_POINTS,
  REFERENCE_COMPARISON_TITLE,
  referenceComparisonHint,
} from './reference-comparison-labels'
import { ReferenceComparisonPanel } from './reference-comparison-panel'
import { PHASE_4 } from '../../pipeline/preconditions'
import { llmModel } from '@/lib/ai'
import { projectResponsesLeft, projectResponsesMax } from '@/lib/ai/quota'
import { Section } from '@/app/components/ui/section'
import { ButtonLink } from '@/app/components/ui/button'
import { Disclosure } from '@/app/components/ui/disclosure'

const EMPTY_SET: ReadonlySet<string> = new Set<string>()

const NEW_ROUND_POINTS: readonly string[] = [
  'Criar a rodada é o momento em que o projeto passa a produzir dado de pesquisa: tudo o ' +
    'que ela produz aponta para um codebook e um prompt que não mudam mais.',
  'Só existe uma rodada aberta por projeto, e abrir uma exige o codebook completo e uma ' +
    'versão de prompt escrita.',
]

export default async function ProjectRoundsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ gerar?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const userId = await requireUserId()

  const {
    access,
    reviewable,
    rounds,
    openRound,
    focusRound,
    focusCodebook,
    codebook,
    prompt,
    items,
    generated,
    observations,
    outliers,
    focusOutliers,
    effort,
    participation,
  } = await transaction(async (tx) => {
    const access = await requireReviewAccess(id, userId, tx)
    const projectId = access.project.id
    const isAdmin = access.isAdmin
    const openRound = isAdmin ? await loadOpenRound(projectId, tx) : null
    const rounds = isAdmin ? await listRounds(projectId, tx) : []
    const focusRound = focusRoundOf(rounds)

    return {
      access,
      openRound,
      rounds,
      focusRound,
      reviewable:
        !isAdmin && access.memberId
          ? await listReviewableRounds(projectId, access.memberId, tx)
          : [],
      codebook: isAdmin ? await loadCodebook(projectId, tx) : null,
      focusCodebook: focusRound
        ? await loadCodebookVersion(projectId, focusRound.codebookVersionId, tx)
        : null,
      prompt: isAdmin ? await loadPrompt(projectId, tx) : null,
      items: openRound ? await loadItems(projectId, tx) : [],
      generated: openRound ? await listRoundResponses(openRound.id, tx) : [],
      observations: isAdmin
        ? await loadProjectObservations(projectId, tx)
        : new Map<string, RoundObservation[]>(),
      outliers: isAdmin
        ? await loadProjectOutliers(projectId, tx)
        : new Map<string, Set<string>>(),
      focusOutliers:
        isAdmin && focusRound ? await loadRoundOutliers(focusRound.id, tx) : [],
      effort: focusRound
        ? await listEvaluatorEffort(focusRound.id, projectId, tx)
        : [],
      participation:
        isAdmin && focusRound?.phase === PHASE_4
          ? await loadEvaluatorParticipation(projectId, tx)
          : null,
    }
  })

  const project = access.project

  if (!access.isAdmin) {
    return (
      <Section
        title="Rodadas para revisar"
        hint="As rodadas fechadas em que você enviou avaliação."
        help="Mostra, resposta por resposta, como cada avaliador pontuou cada célula do codebook da rodada. Fica presa à rodada, porque é dela que o refinamento sai."
      >
        <EvaluatorRounds projectId={project.id} rounds={reviewable} />
      </Section>
    )
  }

  const agreement = new Map<string, AgreementPair>(
    rounds.map((round) => [
      round.id,
      agreementPair(
        observations.get(round.id) ?? [],
        outliers.get(round.id) ?? EMPTY_SET,
      ),
    ]),
  )
  const quality = new Map<string, QualityPair>(
    rounds
      .filter((round) => hasQuality(round.phase))
      .map((round) => [
        round.id,
        qualityPair(
          observations.get(round.id) ?? [],
          outliers.get(round.id) ?? EMPTY_SET,
        ),
      ]),
  )
  const focusPair =
    (focusRound ? agreement.get(focusRound.id) : undefined) ??
    agreementPair([], EMPTY_SET)
  const focusQuality = focusRound ? quality.get(focusRound.id) : undefined
  const focusComparison = focusRound
    ? referenceComparison(rounds, focusRound, agreement, quality)
    : null
  const focusParticipation =
    focusRound && participation
      ? participationBefore(participation, focusRound.roundNumber)
      : undefined
  const focusObservations = focusRound ? (observations.get(focusRound.id) ?? []) : []
  const focusExcluded = focusRound
    ? (outliers.get(focusRound.id) ?? EMPTY_SET)
    : EMPTY_SET
  const focusDefinitions = focusCodebook?.definitions ?? []
  const focusCriteria = focusCodebook?.criteria ?? []
  const focusByDefinition = byDefinitionSummary(
    focusDefinitions.length,
    matrixColumns(focusDefinitions, focusCriteria).length,
  )
  const focusMatrix = focusRound ? (
    <AgreementMatrixTable
      definitions={focusDefinitions}
      criteria={focusCriteria}
      observations={focusObservations}
      codebookVersionNumber={focusRound.codebookVersionNumber}
    />
  ) : null
  const focusQualityMatrix = focusRound ? (
    <QualityMatrixTable
      definitions={focusDefinitions}
      criteria={focusCriteria}
      observations={focusObservations}
      excluded={focusExcluded}
      codebookVersionNumber={focusRound.codebookVersionNumber}
    />
  ) : null
  const responses = {
    all: evaluatedResponses(focusObservations),
    withoutOutliers: evaluatedResponses(
      withoutExcluded(focusObservations, focusExcluded),
    ),
  }

  const openSummary = openRound
    ? rounds.find((round) => round.id === openRound.id)
    : undefined
  const roundsHref = `/projects/${project.id}/rounds`
  const generating = query.gerar !== undefined

  const codebookVersionNumber = codebook?.version?.versionNumber ?? null
  const promptVersionNumber = prompt?.version?.versionNumber ?? null

  const blockers = roundBlockers({
    phase: project.phase,
    definitions: codebook?.definitions ?? [],
    criteria: codebook?.criteria ?? [],
    hasPromptVersion: prompt?.version != null,
    openRoundNumber: openRound?.roundNumber ?? null,
    versions: referenceVersionsOf(rounds, {
      codebook: codebookVersionNumber,
      prompt: promptVersionNumber,
    }),
  })

  const shortcuts = readingShortcuts({
    agreement: focusRound !== null,
    quality: focusQuality !== undefined,
    ...(openRound ? { rounds: rounds.length } : {}),
    ...(focusRound ? { review: `${roundsHref}/${focusRound.id}` } : {}),
  })

  const roundList = (
    <Section
      id={ROUNDS_SECTION_ID}
      className="scroll-mt-6"
      title="Rodadas do projeto"
    >
      <RoundList
        projectId={project.id}
        rounds={rounds}
        agreement={agreement}
        quality={quality}
      />
    </Section>
  )

  return (
    <>
      {openRound && openSummary ? (
        <OpenRoundCard
          round={openSummary}
          generateHref={`${roundsHref}?gerar=1#${GENERATE_PANEL_ID}`}
          effort={effort}
          excluded={new Set(focusOutliers.map((mark) => mark.projectMemberId))}
          {...(focusParticipation ? { participation: focusParticipation } : {})}
          generated={generated}
          close={
            <CloseRound
              projectId={project.id}
              round={openRound}
              evaluatorsNotFinished={evaluatorsNotFinished(effort, generated.length)}
              activeEvaluators={effort.filter(isActiveEvaluator).length}
            />
          }
        />
      ) : (
        <Section
          title="Nova rodada"
          help="A rodada é a unidade de coleta: dentro dela as respostas são geradas e avaliadas."
          more={{ points: NEW_ROUND_POINTS }}
        >
          <NewRound
            projectId={project.id}
            phase={project.phase}
            blockers={blockers}
            codebookVersionNumber={codebookVersionNumber}
            promptVersionNumber={promptVersionNumber}
          />
        </Section>
      )}

      {shortcuts.length > 0 ? <ReadingShortcuts links={shortcuts} /> : null}

      {openRound ? null : roundList}

      {openRound && generating ? (
        <Section
          id={GENERATE_PANEL_ID}
          className="scroll-mt-6"
          title={`Gerar respostas na rodada ${openRound.roundNumber}`}
          hint={`De 1 a ${SELECTION_MAX} itens por geração, e cada item produz exatamente uma resposta.`}
          help="Cada resposta grava origem, modelo, versão do modelo e as versões de codebook e de prompt que esta rodada fixou."
          action={
            <ButtonLink href={roundsHref} variant="secondary" size="sm">
              Cancelar
            </ButtonLink>
          }
        >
          <GenerateResponses
            projectId={project.id}
            round={openRound}
            items={items}
            generated={generated}
            model={llmModel()}
            responsesLeft={projectResponsesLeft(project.id)}
            responsesMax={projectResponsesMax()}
          />
        </Section>
      ) : null}

      {focusRound && hasReadingGuidance(focusRound.phase) ? (
        <ReadingGuidanceNote
          guidance={readingGuidance(focusPair.all, focusRound.phase)}
          projectId={project.id}
        />
      ) : null}

      {focusRound && focusComparison && focusComparison.kind !== 'not_phase_4' ? (
        <Section
          title={REFERENCE_COMPARISON_TITLE}
          hint={
            focusComparison.kind === 'compared'
              ? referenceComparisonHint(
                  focusRound.roundNumber,
                  focusComparison.reference.roundNumber,
                )
              : undefined
          }
          help={REFERENCE_COMPARISON_HELP}
          more={{ points: REFERENCE_COMPARISON_POINTS }}
        >
          <ReferenceComparisonPanel
            roundNumber={focusRound.roundNumber}
            comparison={focusComparison}
          />
        </Section>
      ) : null}

      {focusRound ? (
        <Section
          id={AGREEMENT_SECTION_ID}
          className="scroll-mt-6"
          title={
            focusRound.closedAt
              ? `Concordância na rodada ${focusRound.roundNumber}, fechada`
              : `Concordância na rodada ${focusRound.roundNumber}`
          }
          hint="Krippendorff's Alpha ordinal, sobre a versão de codebook que a rodada fixou."
          help="Krippendorff's Alpha ordinal"
        >
          <div className="flex flex-col gap-4">
            <AgreementPanel
              pair={focusPair}
              profiles={profilePair(focusObservations, focusExcluded)}
              responses={responses}
              effort={openRound ? [] : effort}
              outliers={focusOutliers}
              {...(focusParticipation && !openRound
                ? { participation: focusParticipation }
                : {})}
            />

            {focusDefinitions.length > 0 && focusCriteria.length > 0 ? (
              <>
                <CriterionAgreementTable
                  definitions={focusDefinitions}
                  criteria={focusCriteria}
                  observations={focusObservations}
                />

                <Disclosure summary={focusByDefinition}>
                  <div className="mt-2">{focusMatrix}</div>
                </Disclosure>
              </>
            ) : (
              focusMatrix
            )}
          </div>
        </Section>
      ) : null}

      {focusRound && focusQuality ? (
        <Section
          id={QUALITY_SECTION_ID}
          className="scroll-mt-6"
          title={
            focusRound.closedAt
              ? `Qualidade na rodada ${focusRound.roundNumber}, fechada`
              : `Qualidade na rodada ${focusRound.roundNumber}`
          }
          hint={QUALITY_HINT}
          more={{ points: QUALITY_POINTS }}
        >
          <div className="flex flex-col gap-4">
            <QualityPanel pair={focusQuality} />

            {focusDefinitions.length > 0 && focusCriteria.length > 0 ? (
              <>
                <CriterionQualityTable
                  definitions={focusDefinitions}
                  criteria={focusCriteria}
                  observations={focusObservations}
                  excluded={focusExcluded}
                />

                <Disclosure summary={focusByDefinition}>
                  <div className="mt-2">{focusQualityMatrix}</div>
                </Disclosure>

                <QualityMatrixNotes
                  criteria={focusCriteria}
                  codebookVersionNumber={focusRound.codebookVersionNumber}
                />
              </>
            ) : (
              focusQualityMatrix
            )}
          </div>
        </Section>
      ) : null}

      {openRound ? roundList : null}
    </>
  )
}
