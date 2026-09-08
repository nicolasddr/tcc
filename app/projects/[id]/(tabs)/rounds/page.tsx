import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../../pipeline/access'
import { loadCodebook } from '../../pipeline/codebook'
import { loadPrompt } from '../../pipeline/prompt'
import { listEvaluatorsNotFinished, listRounds, loadOpenRound } from './rounds'
import { roundBlockers } from './preconditions'
import { NewRound } from './new-round'
import { CloseRound } from './close-round'
import { RoundList } from './round-list'
import { Section } from '@/app/components/ui/section'

export default async function ProjectRoundsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { access, rounds, openRound, codebook, prompt, evaluatorsNotFinished } =
    await transaction(async (tx) => {
      const access = await loadPipelineAccess(id, userId, tx)
      const projectId = access.project?.id

      return {
        access,
        rounds: projectId ? await listRounds(projectId, tx) : [],
        openRound: projectId ? await loadOpenRound(projectId, tx) : null,
        codebook: projectId ? await loadCodebook(projectId, tx) : null,
        prompt: projectId ? await loadPrompt(projectId, tx) : null,
        evaluatorsNotFinished: projectId
          ? await listEvaluatorsNotFinished(projectId, tx)
          : [],
      }
    })

  const project = requirePipelineAdmin(access, id)

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
        hint="Em ordem cronológica, com o estado de cada uma e as versões de codebook e de prompt que ela fixou."
      >
        <RoundList rounds={rounds} />
      </Section>
    </>
  )
}
