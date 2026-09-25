import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../../pipeline/access'
import { loadPrompt, listPromptVersions } from '../../pipeline/prompt'
import { PromptEditor } from '../../pipeline/prompt-editor'
import { PromptMetadataEditor } from '../../pipeline/prompt-metadata-editor'
import { PromptHistory } from '../../pipeline/prompt-history'
import { PromptTest } from '../../pipeline/prompt-test'
import { loadItems } from '../../pipeline/items'
import { loadCodebook } from '../../pipeline/codebook'
import { EMPTY_PIPELINE, canAdvanceFromPhase1 } from '../../pipeline/preconditions'
import { llmModel } from '@/lib/ai'
import { Card } from '@/app/components/ui/card'
import { Disclosure } from '@/app/components/ui/disclosure'
import { Panel } from '@/app/components/ui/panel'
import { Section } from '@/app/components/ui/section'
import { InfoTooltip } from '@/app/components/ui/tooltip'

const HISTORY_ANCHOR = 'historico-do-prompt'

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
    <>
      <div className="mt-6 flex flex-col gap-4">
        <PromptEditor
          projectId={project.id}
          version={prompt.version}
          isOpen={prompt.isOpen}
          definitions={codebook.definitions.length}
          items={items.length}
          historyAnchor={HISTORY_ANCHOR}
        />

        <Card>
          <Disclosure summary="Detalhes da versão — nome, descrição, o que mudou">
            <div className="mt-3 flex flex-col gap-3">
              <p className="m-0 text-[13px] text-muted">
                Nome, descrição e registro de mudanças são opcionais, valem para a versão
                mais recente e podem ser corrigidos a qualquer momento: como não vão à
                LLM, editá-los não cria versão nova.
              </p>
              <PromptMetadataEditor projectId={project.id} version={prompt.version} />
            </div>
          </Disclosure>
        </Card>

        <Panel
          tone="accent"
          title={
            <>
              Testar o prompt
              <InfoTooltip text="A verificação que fecha a Fase 1: a saída aparece aqui na tela e não é gravada em lugar nenhum." />
            </>
          }
        >
          <PromptTest
            projectId={project.id}
            items={items}
            model={llmModel()}
            ready={canAdvanceFromPhase1(inputs)}
            phase={project.phase}
          />
        </Panel>
      </div>

      <div id={HISTORY_ANCHOR} className="scroll-mt-4">
        <Section
          title="Histórico de versões"
          hint="Da mais recente para a mais antiga."
          help="Abrir uma versão mostra o texto como estava nela, em leitura: versão congelada não é editável nem apagável."
        >
          <PromptHistory projectId={project.id} versions={versions} />
        </Section>
      </div>
    </>
  )
}
