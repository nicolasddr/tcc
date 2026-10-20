import type { MembershipRow } from './evaluator-link'

const ACCESS_STATUSES: readonly string[] = ['active', 'pending_onboarding']

export function accessRows<Row extends MembershipRow>(rows: readonly Row[]): Row[] {
  return rows.filter((row) => ACCESS_STATUSES.includes(row.status))
}

export function canViewProject({
  memberships,
  hasInvitation,
}: {
  memberships: readonly MembershipRow[]
  hasInvitation: boolean
}): boolean {
  return hasInvitation || accessRows(memberships).length > 0
}
