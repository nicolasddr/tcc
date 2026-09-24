import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadCodebook, loadCodebookVersion } from '../../pipeline/codebook'
import { loadPrompt } from '../../pipeline/prompt'
import { loadItems } from '../../pipeline/items'
import { listRoundResponses } from '../../pipeline/responses'
import { isOpen, listRounds, loadOpenRound } from './rounds'
import {
  listEvaluatorEffort,
  loadProjectObservations,
  type RoundObservation,
} from './agreement'
import {
  agreementPair,
  evaluatedResponses,
  withoutExcluded,
  type AgreementPair,
} from './agreement-pair'
import { loadProjectOutliers, loadRoundOutliers } from './outliers'
import { evaluatorsNotFinished, isActiveEvaluator, roundBlockers } from './preconditions'
import { NewRound } from './new-round'
import { CloseRound } from './close-round'
import { GenerateResponses } from './generate-responses'
import { RoundList } from './round-list'
import { EvaluatorRounds } from './evaluator-rounds'
import { listReviewableRounds } from './review'
import { requireReviewAccess } from './review-access'
import { AgreementPanel } from './agreement-panel'
import { AgreementMatrixTable } from './agreement-matrix-table'
import { llmModel } from '@/lib/ai'
import { projectResponsesLeft, projectResponsesMax } from '@/lib/ai/quota'
import { Section } from '@/app/components/ui/section'
import { formatDate } from '@/app/notifications/labels'

const EMPTY_SET: ReadonlySet<string> = new Set<string>()

export default async function ProjectRoundsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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
  } = await transaction(async (tx) => {
    const access = await requireReviewAccess(id, userId, tx)
    const projectId = access.project.id
    const isAdmin = access.isAdmin
    const openRound = isAdmin ? await loadOpenRound(projectId, tx) : null
    const rounds = isAdmin ? await listRounds(projectId, tx) : []
    const focusRound = rounds.find(isOpen) ?? rounds[rounds.length - 1] ?? null

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
    }
  })

  const project = access.project

  if (!access.isAdmin) {
    return (
      <Section
        title="Rodadas para revisar"
        hint="As rodadas fechadas em que você enviou avaliação."
        help="A revisão mostra, resposta por resposta, como cada avaliador pontuou cada célula do codebook que aquela rodada fixou — e fica presa à rodada, porque é dela que o refinamento sai."
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
  const focusObservations = focusRound ? (observations.get(focusRound.id) ?? []) : []
  const focusExcluded = focusRound
    ? (outliers.get(focusRound.id) ?? EMPTY_SET)
    : EMPTY_SET
  const responses = {
    all: evaluatedResponses(focusObservations),
    withoutOutliers: evaluatedResponses(
      withoutExcluded(focusObservations, focusExcluded),
    ),
  }

  const blockers = roundBlockers({
    phase: project.phase,
    definitions: codebook?.definitions ?? [],
    criteria: codebook?.criteria ?? [],
    hasPromptVersion: prompt?.version != null,
    openRoundNumber: openRound?.roundNumber ?? null,
  })

  const codebookVersionNumber = codebook?.version?.versionNumber ?? null
  const promptVersionNumber = prompt?.version?.versionNumber ?? null

  return (
    <>
      {openRound ? (
        <>
          <Section
            title={`Gerar respostas na rodada ${openRound.roundNumber}`}
            hint="De 1 a 5 itens por geração, e cada item produz exatamente uma resposta."
            help="Cada resposta grava origem, modelo, versão do modelo e as versões de codebook e de prompt que esta rodada fixou."
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

          <Section
            title={`Rodada ${openRound.roundNumber} aberta`}
            hint="Só existe uma rodada aberta por projeto."
            help="Fechar é ação sua, é irreversível e não depende de todos terem terminado."
          >
            <CloseRound
              projectId={project.id}
              round={openRound}
              evaluatorsNotFinished={evaluatorsNotFinished(effort, generated.length)}
              activeEvaluators={effort.filter(isActiveEvaluator).length}
              codebookVersionNumber={codebookVersionNumber}
              promptVersionNumber={promptVersionNumber}
            />
          </Section>
        </>
      ) : (
        <Section
          title="Nova rodada"
          help="A rodada é a unidade de coleta: é dentro dela que as respostas são geradas e avaliadas, e criá-la é o momento em que o projeto passa a produzir dado de pesquisa. Só existe uma rodada aberta por projeto, e abrir uma exige o codebook completo e uma versão de prompt escrita."
        >
          <NewRound
            projectId={project.id}
            blockers={blockers}
            codebookVersionNumber={codebookVersionNumber}
            promptVersionNumber={promptVersionNumber}
          />
        </Section>
      )}

      {focusRound ? (
        <Section
          title={
            focusRound.closedAt
              ? `Concordância na rodada ${focusRound.roundNumber}, fechada`
              : `Concordância na rodada ${focusRound.roundNumber}`
          }
          hint={
            focusRound.closedAt
              ? `Krippendorff's Alpha ordinal da rodada ${focusRound.roundNumber}, fechada em ${formatDate(focusRound.closedAt)}.`
              : "Krippendorff's Alpha ordinal desta rodada."
          }
          help={
            focusRound.closedAt
              ? 'O coeficiente é sobre a versão de codebook que esta rodada fixou. É a última rodada do projeto, e a leitura continua aqui depois do fechamento: é com ela que se decide onde refinar o codebook antes da próxima rodada.'
              : 'O coeficiente é sobre a versão de codebook que esta rodada fixou. O valor aparece desde a primeira avaliação e não trava nada: fechar a rodada e avançar de fase continuam sendo decisão sua.'
          }
        >
          <div className="flex flex-col gap-4">
            <AgreementPanel
              pair={agreement.get(focusRound.id) ?? agreementPair([], EMPTY_SET)}
              responses={responses}
              effort={effort}
              outliers={focusOutliers}
            />

            <AgreementMatrixTable
              definitions={focusCodebook?.definitions ?? []}
              criteria={focusCodebook?.criteria ?? []}
              observations={focusObservations}
              codebookVersionNumber={focusRound.codebookVersionNumber}
            />
          </div>
        </Section>
      ) : null}

      <Section
        title="Rodadas do projeto"
        hint="Em ordem cronológica, com o estado de cada uma."
        help="Cada rodada aparece com as versões de codebook e de prompt que ela fixou e a concordância alcançada sobre elas."
      >
        <RoundList projectId={project.id} rounds={rounds} agreement={agreement} />
      </Section>
    </>
  )
}
