import { isVersionOpen, type VersionSnapshot } from '@/lib/versioning'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type VersionAudit = VersionSnapshot & {
  createdAt: string
  updatedAt: string | null
}

export type Summarized<T> = T & { isLatest: boolean; isOpen: boolean }

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

export function summarize<T extends VersionAudit>(
  version: T,
  latest: VersionSnapshot | null,
): Summarized<T> {
  return {
    ...version,
    isLatest: latest !== null && version.id === latest.id,
    isOpen: isVersionOpen(version, latest),
  }
}
