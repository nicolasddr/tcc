import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../pipeline/access'
import { loadCodebook, listCodebookVersions } from '../pipeline/codebook'
import { CodebookEditor } from '../pipeline/codebook-editor'
import { CodebookHistory } from '../pipeline/codebook-history'
import { PHASE_2 } from '../pipeline/preconditions'
import { ProjectTabs } from '../project-tabs'
import { defaultDefinitionType } from '@/app/projects/definition-types'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

export default async function ProjectCodebookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { access, codebook, versions } = await transaction(async (tx) => {
    const access = await loadPipelineAccess(id, userId, tx)
    const projectId = access.project?.id

    const codebook = projectId ? await loadCodebook(projectId, tx) : null
    const versions = projectId ? await listCodebookVersions(projectId, tx) : []

    return { access, codebook, versions }
  })

  const project = requirePipelineAdmin(access, id)
  if (!codebook) notFound()

  return (
    <PageShell
      width="wide"
      header={
        <TopBar>
          <BackLink href={`/projects/${id}`}>Voltar ao projeto</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Codebook</PageTitle>
      <PageSubtitle>{project.name}</PageSubtitle>

      <ProjectTabs projectId={project.id} isAdmin active="codebook" />

      <Section
        title="Definições"
        hint={
          project.phase >= PHASE_2
            ? 'Os conceitos que estruturam a tarefa da LLM, cada um com título, tipo e a descrição que o avaliador lê. Só os títulos vão para a LLM.'
            : 'Os conceitos que estruturam a tarefa da LLM, cada um com título e tipo. A descrição de cada definição é escrita na Fase 2.'
        }
      >
        <CodebookEditor
          projectId={project.id}
          phase={project.phase}
          version={codebook.version}
          isOpen={codebook.isOpen}
          definitions={codebook.definitions}
          defaultType={defaultDefinitionType(project.taskType)}
        />
      </Section>

      <Section
        title="Histórico de versões"
        hint="Da mais recente para a mais antiga. Abrir uma versão mostra as definições e a ordem como estavam nela, em leitura: versão congelada não é editável nem apagável."
      >
        <CodebookHistory projectId={project.id} versions={versions} />
      </Section>
    </PageShell>
  )
}
