import { Badge } from '@/app/components/ui/badge'
import { formatDate } from '@/app/notifications/labels'

export function VersionBadges({
  version,
}: {
  version: { isLatest: boolean; isOpen: boolean }
}) {
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

export function VersionMeta({
  version,
}: {
  version: { createdAt: string; updatedAt: string | null; authorName: string }
}) {
  return (
    <p className="m-0 text-[13px] text-muted">
      Salva em {formatDate(version.createdAt)} por {version.authorName}
      {version.updatedAt
        ? ` · última alteração em ${formatDate(version.updatedAt)}`
        : null}
    </p>
  )
}
