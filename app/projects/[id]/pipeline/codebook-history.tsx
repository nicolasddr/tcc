import { ButtonLink } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { formatDate } from '@/app/notifications/labels'
import type { CodebookVersionSummary } from './codebook'

export function VersionBadges({ version }: { version: CodebookVersionSummary }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {version.isLatest ? <Badge tone="accent">vigente</Badge> : null}
      {version.isOpen ? (
        <Badge tone="info">em aberto</Badge>
      ) : (
        <Badge tone="neutral">congelada</Badge>
      )}
    </span>
  )
}

export function VersionMeta({ version }: { version: CodebookVersionSummary }) {
  return (
    <p className="m-0 text-[13px] text-muted">
      Salva em {formatDate(version.createdAt)} por {version.authorName}
      {version.updatedAt
        ? ` · última alteração em ${formatDate(version.updatedAt)}`
        : null}
    </p>
  )
}

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
                href={`/projects/${projectId}/pipeline/codebook/${version.id}`}
                variant="secondary"
                size="sm"
              >
                Ver definições
              </ButtonLink>
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
