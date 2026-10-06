import type { EvaluatorParticipation } from './[id]/(tabs)/rounds/participation'
import { participationLabel } from './[id]/round-usage'

export type MemberRow = {
  memberId: string
  userId: string
  role: string
  status: string
  name: string
  email: string
}

export type ListedMember = {
  userId: string
  name: string
  email: string
  roles: string[]
  status: string // status agregado do usuário no projeto
}


export function aggregateStatus(statuses: string[]): string {
  if (statuses.includes('active')) return 'active'
  if (statuses.includes('pending_onboarding')) return 'pending_onboarding'
  return 'inactive'
}

export function groupMembers(rows: MemberRow[]): ListedMember[] {
  const byUser = new Map<string, ListedMember & { _statuses: string[] }>()
  for (const row of rows) {
    let entry = byUser.get(row.userId)
    if (!entry) {
      entry = {
        userId: row.userId,
        name: row.name,
        email: row.email,
        roles: [],
        status: row.status,
        _statuses: [],
      }
      byUser.set(row.userId, entry)
    }
    if (!entry.roles.includes(row.role)) entry.roles.push(row.role)
    entry._statuses.push(row.status)
  }
  return [...byUser.values()]
    .map(({ _statuses, ...m }) => ({ ...m, status: aggregateStatus(_statuses) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function participationByUser(
  rows: readonly MemberRow[],
  participation: EvaluatorParticipation,
): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const row of rows) {
    if (row.role !== 'evaluator') continue
    const label = participationLabel(participation.get(row.memberId) ?? [])
    if (label) labels[row.userId] = label
  }
  return labels
}
