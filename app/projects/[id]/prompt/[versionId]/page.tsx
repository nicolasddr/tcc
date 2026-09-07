import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadPipelineAccess, requirePipelineAdmin } from '../../pipeline/access'
import { hasPromptMetadata, loadPromptVersion } from '../../pipeline/prompt'
import { VersionBadges, VersionMeta } from '../../pipeline/version-history'
import { PromptMetadataList } from '../../pipeline/prompt-metadata'
import { Card } from '@/app/components/ui/card'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

export default async function PromptVersionPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>
}) {
  const { id, versionId } = await params
  const userId = await requireUserId()

  const { access, version } = await transaction(async (tx) => {
    const access = await loadPipelineAccess(id, userId, tx)
    const version = access.project ? await loadPromptVersion(id, versionId, tx) : null
    return { access, version }
  })

  const project = requirePipelineAdmin(access, id)
  if (!version) notFound()

  return (
    <PageShell
      width="wide"
      header={
        <TopBar>
          <BackLink href={`/projects/${id}/prompt`}>Voltar ao prompt</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Versão {version.versionNumber} do prompt</PageTitle>
      <PageSubtitle>{project.name}</PageSubtitle>

      <div className="flex flex-col gap-2">
        <VersionBadges version={version} />
        <VersionMeta version={version} />
      </div>

      {hasPromptMetadata(version) ? (
        <Card tone="subtle" padding="sm" className="mt-4">
          <PromptMetadataList version={version} />
        </Card>
      ) : null}

      <Section
        title="Texto desta versão"
        hint="Em leitura, com a mesma formatação com que foi salvo."
      >
        <Card padding="sm">
          <p className="m-0 max-h-[60vh] overflow-auto font-mono text-[13px] leading-[1.6] break-words whitespace-pre-wrap text-ink">
            {version.text}
          </p>
        </Card>
      </Section>
    </PageShell>
  )
}
