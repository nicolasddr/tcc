import { ButtonLink } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { VersionBadges, VersionCounts, VersionMeta } from './version-history'
import type { CodebookVersionSummary } from './codebook'

export function CodebookHistory({
  projectId,
  versions,
}: {
  projectId: string
  versions: CodebookVersionSummary[]
}) {
  if (versions.length === 0) {
    return (
      <EmptyState>
        Nenhuma versão do codebook ainda. O primeiro salvamento das definições cria a
        versão 1.
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
                href={`/projects/${projectId}/codebook/${version.id}`}
                variant="secondary"
                size="sm"
              >
                Ver definições
              </ButtonLink>
            </div>

            <div className="mt-1.5">
              <VersionCounts version={version} />
            </div>

            <div className="mt-1.5">
              <VersionMeta version={version} />
            </div>

            {version.note ? (
              <p className="m-0 mt-2.5 text-[13px] break-words text-ink">
                {version.note}
              </p>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  )
}
