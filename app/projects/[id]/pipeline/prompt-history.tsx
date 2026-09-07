import { ButtonLink } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { VersionBadges, VersionMeta } from './version-history'
import { PromptMetadataList } from './prompt-metadata'
import { hasPromptMetadata, type PromptVersionSummary } from './prompt'

export function PromptHistory({
  projectId,
  versions,
}: {
  projectId: string
  versions: PromptVersionSummary[]
}) {
  if (versions.length === 0) {
    return (
      <EmptyState>
        Nenhuma versão do prompt ainda. O primeiro salvamento do texto cria a versão 1.
      </EmptyState>
    )
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {versions.map((version) => (
        <li key={version.id}>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm font-semibold text-ink">
                  Versão {version.versionNumber}
                </span>
                <VersionBadges version={version} />
              </span>

              <ButtonLink
                href={`/projects/${projectId}/prompt/${version.id}`}
                variant="secondary"
                size="sm"
              >
                Ver texto
              </ButtonLink>
            </div>

            <div className="mt-1.5">
              <VersionMeta version={version} />
            </div>

            {hasPromptMetadata(version) ? (
              <div className="mt-2.5">
                <PromptMetadataList version={version} />
              </div>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  )
}
