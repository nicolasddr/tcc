import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../pipeline/access'
import { loadPrompt, listPromptVersions } from '../pipeline/prompt'
import { PromptEditor } from '../pipeline/prompt-editor'
import { PromptMetadataEditor } from '../pipeline/prompt-metadata-editor'
import { PromptHistory } from '../pipeline/prompt-history'
import { PromptTest } from '../pipeline/prompt-test'
import { loadItems } from '../pipeline/items'
import { loadCodebook } from '../pipeline/codebook'
import { EMPTY_PIPELINE, canAdvanceFromPhase1 } from '../pipeline/preconditions'
import { ProjectTabs } from '../project-tabs'
import { llmModel } from '@/lib/ai'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

export default async function ProjectPromptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { access, prompt, versions, codebook, items } = await transaction(async (tx) => {
    const access = await loadPipelineAccess(id, userId, tx)
    const projectId = access.project?.id

    const prompt = projectId ? await loadPrompt(projectId, tx) : null
    const versions = projectId ? await listPromptVersions(projectId, tx) : []
    const codebook = projectId ? await loadCodebook(projectId, tx) : null
    const items = projectId ? await loadItems(projectId, tx) : null

    return { access, prompt, versions, codebook, items }
  })

  const project = requirePipelineAdmin(access, id)
  if (!prompt || !codebook || !items) notFound()

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
      <PageTitle>Prompt</PageTitle>
      <PageSubtitle>{project.name}</PageSubtitle>

      <ProjectTabs projectId={project.id} isAdmin active="prompt" />

      <Section
        title="Texto do prompt"
        hint="A instrução enviada à LLM, versionada de forma independente do codebook."
      >
        <PromptEditor
          projectId={project.id}
          version={prompt.version}
          isOpen={prompt.isOpen}
        />
      </Section>

      <Section
        title="Dados desta versão do prompt"
        hint="Nome, descrição e registro de mudanças são opcionais, valem para a versão mais recente e podem ser corrigidos a qualquer momento: como não vão à LLM, editá-los não cria versão nova."
      >
        <PromptMetadataEditor projectId={project.id} version={prompt.version} />
      </Section>

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

      <Section
        title="Histórico de versões"
        hint="Da mais recente para a mais antiga. Abrir uma versão mostra o texto como estava nela, em leitura: versão congelada não é editável nem apagável."
      >
        <PromptHistory projectId={project.id} versions={versions} />
      </Section>
    </PageShell>
  )
}
