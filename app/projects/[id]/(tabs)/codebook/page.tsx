import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../../pipeline/access'
import { loadCodebook, listCodebookVersions } from '../../pipeline/codebook'
import { CodebookEditor } from '../../pipeline/codebook-editor'
import { CodebookHistory } from '../../pipeline/codebook-history'
import { PHASE_2 } from '../../pipeline/preconditions'
import { loadOpenRound } from '../rounds/rounds'
import { defaultDefinitionType } from '@/app/projects/definition-types'
import { Section } from '@/app/components/ui/section'

export default async function ProjectCodebookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { access, codebook, versions, openRound } = await transaction(async (tx) => {
    const access = await loadPipelineAccess(id, userId, tx)
    const projectId = access.project?.id

    const codebook = projectId ? await loadCodebook(projectId, tx) : null
    const versions = projectId ? await listCodebookVersions(projectId, tx) : []
    const openRound = projectId ? await loadOpenRound(projectId, tx) : null

    return { access, codebook, versions, openRound }
  })

  const project = requirePipelineAdmin(access, id)
  if (!codebook) notFound()

  return (
    <>
      <Section
        title="Definições"
        hint="Os conceitos que estruturam a tarefa da LLM."
        help={
          project.phase >= PHASE_2
            ? 'Os conceitos que estruturam a tarefa da LLM, cada um com título, tipo, a descrição que o avaliador lê e os critérios com que ele julga. Só os títulos vão para a LLM.'
            : 'Os conceitos que estruturam a tarefa da LLM, cada um com título e tipo. A descrição e os critérios de cada definição são escritos na Fase 2.'
        }
      >
        <CodebookEditor
          projectId={project.id}
          phase={project.phase}
          version={codebook.version}
          isOpen={codebook.isOpen}
          openRoundNumber={openRound?.roundNumber ?? null}
          definitions={codebook.definitions}
          criteria={codebook.criteria}
          defaultType={defaultDefinitionType(project.taskType)}
        />
      </Section>

      <Section
        title="Histórico de versões"
        hint="Da mais recente para a mais antiga, com a contagem de definições e de critérios de cada uma. Abrir uma versão mostra as definições e a ordem como estavam nela, em leitura: versão congelada não é editável nem apagável."
      >
        <CodebookHistory projectId={project.id} versions={versions} />
      </Section>
    </>
  )
}
