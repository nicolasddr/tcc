export type VersionSnapshot = {
  id: string
  versionNumber: number
  usedAt: string | null
}

export function isVersionOpen(
  version: VersionSnapshot,
  latest: VersionSnapshot | null,
): boolean {
  return version.usedAt === null && latest !== null && version.id === latest.id
}

export function nextVersionNumber(latest: VersionSnapshot | null): number {
  return latest ? latest.versionNumber + 1 : 1
}

export type SaveDecision =
  | { mode: 'update'; versionId: string }
  | { mode: 'create'; versionNumber: number }
  | { mode: 'stale' }

export function decideSave(
  latest: VersionSnapshot | null,
  targetVersionId: string | null,
): SaveDecision {
  if (targetVersionId && (latest === null || targetVersionId !== latest.id)) {
    return { mode: 'stale' }
  }
  if (latest && isVersionOpen(latest, latest)) {
    return { mode: 'update', versionId: latest.id }
  }
  return { mode: 'create', versionNumber: nextVersionNumber(latest) }
}
