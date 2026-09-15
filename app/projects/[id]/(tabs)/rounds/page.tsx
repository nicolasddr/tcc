import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../../pipeline/access'
import { loadCodebook } from '../../pipeline/codebook'
import { loadPrompt } from '../../pipeline/prompt'
import { loadItems } from '../../pipeline/items'
import { listRoundResponses } from '../../pipeline/responses'
import { listEvaluatorsNotFinished, listRounds, loadOpenRound } from './rounds'
import {
  listEvaluatorEffort,
  loadProjectObservations,
  type RoundObservation,
} from './agreement'
import { roundBlockers } from './preconditions'
import { NewRound } from './new-round'
import { CloseRound } from './close-round'
import { GenerateResponses } from './generate-responses'
import { RoundList } from './round-list'
import { AgreementPanel } from './agreement-panel'
import { ordinalAlpha, type Agreement } from '@/lib/agreement'
import { llmModel } from '@/lib/ai'
import { projectResponsesLeft, projectResponsesMax } from '@/lib/ai/quota'
import { Section } from '@/app/components/ui/section'

export default async function ProjectRoundsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const {
    access,
    rounds,
    openRound,
    codebook,
    prompt,
    evaluatorsNotFinished,
    items,
    generated,
    observations,
    effort,
  } = await transaction(async (tx) => {
    const access = await loadPipelineAccess(id, userId, tx)
    const projectId = access.project?.id
    const openRound = projectId ? await loadOpenRound(projectId, tx) : null

    return {
      access,
      openRound,
      rounds: projectId ? await listRounds(projectId, tx) : [],
      codebook: projectId ? await loadCodebook(projectId, tx) : null,
      prompt: projectId ? await loadPrompt(projectId, tx) : null,
      evaluatorsNotFinished: projectId
        ? await listEvaluatorsNotFinished(projectId, tx)
        : [],
      items: projectId && openRound ? await loadItems(projectId, tx) : [],
      generated: openRound ? await listRoundResponses(openRound.id, tx) : [],
      observations: projectId
        ? await loadProjectObservations(projectId, tx)
        : new Map<string, RoundObservation[]>(),
      effort:
        projectId && openRound
          ? await listEvaluatorEffort(openRound.id, projectId, tx)
          : [],
    }
  })

  const project = requirePipelineAdmin(access, id)

  const agreement = new Map<string, Agreement>(
    rounds.map((round) => [round.id, ordinalAlpha(observations.get(round.id) ?? [])]),
  )
  const openObservations = openRound ? (observations.get(openRound.id) ?? []) : []
  const evaluatedResponses = new Set(
    openObservations.map((observation) => observation.responseId),
  ).size

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
            hint="De 1 a 5 itens por geração, cada item produzindo exatamente uma resposta, que grava origem, modelo, versão do modelo e as versões de codebook e de prompt que esta rodada fixou."
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
            title={`Concordância na rodada ${openRound.roundNumber}`}
            hint="Krippendorff's Alpha ordinal desta rodada, sobre a versão de codebook que ela fixou. O valor aparece desde a primeira avaliação e não trava nada: fechar a rodada e avançar de fase continuam sendo decisão sua."
          >
            <AgreementPanel
              agreement={agreement.get(openRound.id) ?? ordinalAlpha([])}
              responses={evaluatedResponses}
              effort={effort}
            />
          </Section>

          <Section
            title={`Rodada ${openRound.roundNumber} aberta`}
            hint="Só existe uma rodada aberta por projeto. Fechar é ação sua, é irreversível e não depende de todos terem terminado."
          >
            <CloseRound
              projectId={project.id}
              round={openRound}
              evaluatorsNotFinished={evaluatorsNotFinished}
              codebookVersionNumber={codebookVersionNumber}
              promptVersionNumber={promptVersionNumber}
            />
          </Section>
        </>
      ) : (
        <Section
          title="Nova rodada"
          hint="Criar a rodada é o momento em que o projeto passa a produzir dado de pesquisa: a versão vigente do codebook e a do prompt congelam na mesma operação."
        >
          <NewRound
            projectId={project.id}
            blockers={blockers}
            codebookVersionNumber={codebookVersionNumber}
            promptVersionNumber={promptVersionNumber}
          />
        </Section>
      )}

      <Section
        title="Rodadas do projeto"
        hint="Em ordem cronológica, com o estado de cada uma, as versões de codebook e de prompt que ela fixou e a concordância alcançada sobre elas."
      >
        <RoundList rounds={rounds} agreement={agreement} />
      </Section>
    </>
  )
}
