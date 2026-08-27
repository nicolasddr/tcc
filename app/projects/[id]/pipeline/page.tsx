import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from './access'
import { ProjectTabs } from '../project-tabs'
import { PhaseBar } from '../phase-bar'
import { PipelineChecklist } from './pipeline-checklist'
import { EMPTY_PIPELINE, canAdvanceFromPhase1 } from './preconditions'
import { loadCodebook } from './codebook'
import { CodebookEditor } from './codebook-editor'
import { loadPrompt } from './prompt'
import { PromptEditor } from './prompt-editor'
import { loadItems } from './items'
import { ItemsEditor } from './items-editor'
import { PromptTest } from './prompt-test'
import { llmModel } from '@/lib/ai'
import { defaultDefinitionType } from '@/app/projects/definition-types'
import { ButtonLink } from '@/app/components/ui/button'
import { HistoryIcon } from '@/app/components/ui/icons'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

function Anchored({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6">
      {children}
    </div>
  )
}

export default async function ProjectPipelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { access, codebook, prompt, items } = await transaction(async (tx) => {
    const access = await loadPipelineAccess(id, userId, tx)
    const projectId = access.project?.id

    const codebook = projectId ? await loadCodebook(projectId, tx) : null
    const prompt = projectId ? await loadPrompt(projectId, tx) : null
    const items = projectId ? await loadItems(projectId, tx) : null

    return { access, codebook, prompt, items }
  })

  const project = requirePipelineAdmin(access, id)

  if (!codebook || !prompt || !items) notFound()

  const inputs = {
    ...EMPTY_PIPELINE,
    definitions: codebook.definitions.length,
    promptText: prompt.version?.text ?? null,
    items: items.length,
  }

  return (
    <PageShell
      width="wide"
      header={
        <TopBar>
          <BackLink href={`/projects/${id}`}>Voltar ao projeto</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Configuração do pipeline</PageTitle>
      <PageSubtitle>{project.name}</PageSubtitle>

      <ProjectTabs projectId={project.id} isAdmin active="pipeline" />

      <PhaseBar className="mt-4" current={project.phase} />

      <PipelineChecklist className="mt-3" inputs={inputs} />

      <Anchored id="definicoes">
        <Section
          title="Definições"
          hint="Os conceitos que estruturam a tarefa da LLM, cada um com título e tipo. A descrição de cada definição é escrita na Fase 2."
        >
          <CodebookEditor
            projectId={project.id}
            version={codebook.version}
            isOpen={codebook.isOpen}
            definitions={codebook.definitions}
            defaultType={defaultDefinitionType(project.taskType)}
          />

          <div className="mt-4">
            <ButtonLink
              href={`/projects/${project.id}/pipeline/codebook`}
              variant="secondary"
              size="sm"
            >
              <HistoryIcon />
              Histórico de versões
            </ButtonLink>
          </div>
        </Section>
      </Anchored>

      <Anchored id="prompt">
        <Section
          title="Prompt"
          hint="A instrução enviada à LLM, versionada de forma independente do codebook."
        >
          <PromptEditor
            projectId={project.id}
            version={prompt.version}
            isOpen={prompt.isOpen}
          />
        </Section>
      </Anchored>

      <Anchored id="itens">
        <Section
          title="Itens de entrada"
          hint="O pool de itens do projeto: cada item vira uma resposta da LLM, e as fases seguintes amostram desse pool."
        >
          <ItemsEditor projectId={project.id} items={items} />
        </Section>
      </Anchored>

      <Anchored id="teste">
        <Section
          title="Testar o prompt"
          hint="A verificação que fecha a Fase 1: a saída aparece aqui na tela e não é gravada em lugar nenhum."
        >
          <PromptTest
            projectId={project.id}
            items={items}
            model={llmModel()}
            ready={canAdvanceFromPhase1(inputs)}
          />
        </Section>
      </Anchored>
    </PageShell>
  )
}
