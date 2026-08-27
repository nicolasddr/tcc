import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../access'
import { listCodebookVersions } from '../codebook'
import { CodebookHistory } from '../codebook-history'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

export default async function CodebookHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { access, versions } = await transaction(async (tx) => {
    const access = await loadPipelineAccess(id, userId, tx)
    const versions = access.project ? await listCodebookVersions(id, tx) : []
    return { access, versions }
  })

  const project = requirePipelineAdmin(access, id)

  return (
    <PageShell
      width="wide"
      header={
        <TopBar>
          <BackLink href={`/projects/${id}/pipeline`}>Voltar à configuração</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Histórico do codebook</PageTitle>
      <PageSubtitle>{project.name}</PageSubtitle>

      <Section
        divider={false}
        title="Versões"
        hint="Da mais recente para a mais antiga. Abrir uma versão mostra as definições e a ordem como estavam nela, em leitura: versão congelada não é editável nem apagável."
      >
        <CodebookHistory projectId={project.id} versions={versions} />
      </Section>
    </PageShell>
  )
}
