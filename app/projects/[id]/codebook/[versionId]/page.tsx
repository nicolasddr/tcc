import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../../pipeline/access'
import { loadCodebookVersion } from '../../pipeline/codebook'
import { VersionBadges, VersionMeta } from '../../pipeline/version-history'
import { DefinitionList } from '../../pipeline/definition-list'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

export default async function CodebookVersionPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>
}) {
  const { id, versionId } = await params
  const userId = await requireUserId()

  const { access, detail } = await transaction(async (tx) => {
    const access = await loadPipelineAccess(id, userId, tx)
    const detail = access.project ? await loadCodebookVersion(id, versionId, tx) : null
    return { access, detail }
  })

  const project = requirePipelineAdmin(access, id)
  if (!detail) notFound()

  const { version, definitions, criteria } = detail

  return (
    <PageShell
      width="wide"
      header={
        <TopBar>
          <BackLink href={`/projects/${id}/codebook`}>Voltar ao codebook</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Versão {version.versionNumber} do codebook</PageTitle>
      <PageSubtitle>{project.name}</PageSubtitle>

      <div className="flex flex-col gap-2">
        <VersionBadges version={version} />
        <VersionMeta version={version} />
      </div>

      {version.note ? (
        <Card tone="subtle" padding="sm" className="mt-4">
          <p className="m-0 text-[13px] break-words text-ink">{version.note}</p>
        </Card>
      ) : null}

      <Section
        title="Definições desta versão"
        hint="Em leitura, na ordem em que foram salvas nesta versão, com os critérios que valiam para cada uma."
      >
        {definitions.length === 0 ? (
          <EmptyState>Esta versão não tem definições.</EmptyState>
        ) : (
          <DefinitionList definitions={definitions} criteria={criteria} />
        )}
      </Section>
    </PageShell>
  )
}
