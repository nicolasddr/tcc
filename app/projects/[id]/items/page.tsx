import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../pipeline/access'
import { loadItems } from '../pipeline/items'
import { ItemsEditor } from '../pipeline/items-editor'
import { ProjectTabs } from '../project-tabs'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

export default async function ProjectItemsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { access, items } = await transaction(async (tx) => {
    const access = await loadPipelineAccess(id, userId, tx)
    const projectId = access.project?.id
    const items = projectId ? await loadItems(projectId, tx) : null

    return { access, items }
  })

  const project = requirePipelineAdmin(access, id)
  if (!items) notFound()

  return (
    <PageShell
      width="wide"
      header={
        <TopBar>
          <BackLink href={`/projects/${id}`}>Voltar ao projeto</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Itens de entrada</PageTitle>
      <PageSubtitle>{project.name}</PageSubtitle>

      <ProjectTabs projectId={project.id} isAdmin active="items" />

      <Section
        title="Itens de entrada"
        hint="O pool de itens do projeto: cada item vira uma resposta da LLM, e as fases seguintes amostram desse pool."
      >
        <ItemsEditor projectId={project.id} items={items} />
      </Section>
    </PageShell>
  )
}
