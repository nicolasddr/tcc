import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../../pipeline/access'
import { loadItems } from '../../pipeline/items'
import { ItemsEditor } from '../../pipeline/items-editor'
import { Section } from '@/app/components/ui/section'

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
    <>
      <Section
        title="Itens de entrada"
        hint="O pool de itens do projeto."
        help="Cada item vira uma resposta da LLM, e as fases seguintes amostram desse pool."
      >
        <ItemsEditor projectId={project.id} items={items} />
      </Section>
    </>
  )
}
