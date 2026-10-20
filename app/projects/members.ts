import type { EvaluatorParticipation } from './[id]/(tabs)/rounds/participation'
import { participationMark, type RoundMark } from './[id]/round-usage'

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
  activeRoles: string[]
  status: string // status agregado do usuário no projeto
}


export function aggregateStatus(statuses: string[]): string {
  if (statuses.includes('active')) return 'active'
  if (statuses.includes('pending_onboarding')) return 'pending_onboarding'
  return 'inactive'
}

function rolesOf(rows: readonly MemberRow[]): string[] {
  const current = rows.filter((r) => r.status !== 'inactive')
  return [...new Set((current.length > 0 ? current : rows).map((r) => r.role))]
}

export function groupMembers(rows: MemberRow[]): ListedMember[] {
  const byUser = new Map<string, ListedMember & { _rows: MemberRow[] }>()
  for (const row of rows) {
    let entry = byUser.get(row.userId)
    if (!entry) {
      entry = {
        userId: row.userId,
        name: row.name,
        email: row.email,
        roles: [],
        activeRoles: [],
        status: row.status,
        _rows: [],
      }
      byUser.set(row.userId, entry)
    }
    entry._rows.push(row)
  }
  return [...byUser.values()]
    .map(({ _rows, ...m }) => ({
      ...m,
      roles: rolesOf(_rows),
      activeRoles: [...new Set(_rows.filter((r) => r.status === 'active').map((r) => r.role))],
      status: aggregateStatus(_rows.map((r) => r.status)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function participationByUser(
  rows: readonly MemberRow[],
  participation: EvaluatorParticipation,
): Record<string, RoundMark> {
  const labels: Record<string, RoundMark> = {}
  for (const row of rows) {
    if (row.role !== 'evaluator') continue
    const mark = participationMark(participation.get(row.memberId) ?? [])
    if (mark) labels[row.userId] = mark
  }
  return labels
}
