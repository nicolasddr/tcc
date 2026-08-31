export type EvaluatorLinkStatus = 'pending_onboarding' | 'active' | 'inactive'

export type MembershipRow = {
  role: string
  status: string
}

export type EvaluatorLink = {
  status: EvaluatorLinkStatus
  submittedEvaluations: number
}

export type EvaluatorRoleView = {
  isAdmin: boolean
  link: EvaluatorLink | null
}

export const SUBMITTED_EVALUATIONS_UNTIL_EPICO_2 = 0

export const ASSUME_DENIED =
  'Apenas o administrador do projeto pode assumir o papel de avaliador.'

export const ASSUME_ALREADY_EVALUATOR =
  'Você já tem o papel de avaliador neste projeto.'

export const REVOKE_DENIED =
  'Apenas o administrador do projeto pode desfazer o próprio papel de avaliador.'

export const REVOKE_NO_LINK = 'Você não tem o papel de avaliador neste projeto.'

export const REVOKE_EVALUATIONS_SUBMITTED =
  'Você já enviou avaliações neste projeto, então o papel de avaliador não pode mais ser desfeito.'

export function evaluatorLinkOf(
  memberships: readonly MembershipRow[],
  submittedEvaluations: number = SUBMITTED_EVALUATIONS_UNTIL_EPICO_2,
): EvaluatorLink | null {
  const row = memberships.find((m) => m.role === 'evaluator')
  if (!row) return null
  return { status: row.status as EvaluatorLinkStatus, submittedEvaluations }
}

export function assumeEvaluatorRefusal(view: EvaluatorRoleView): string | null {
  if (!view.isAdmin) return ASSUME_DENIED
  if (view.link) return ASSUME_ALREADY_EVALUATOR
  return null
}

export function revokeEvaluatorRefusal(view: EvaluatorRoleView): string | null {
  if (!view.isAdmin) return REVOKE_DENIED
  if (!view.link) return REVOKE_NO_LINK
  if (view.link.submittedEvaluations > 0) return REVOKE_EVALUATIONS_SUBMITTED
  return null
}

export function canAssumeEvaluatorRole(view: EvaluatorRoleView): boolean {
  return assumeEvaluatorRefusal(view) === null
}

export function canRevokeEvaluatorRole(view: EvaluatorRoleView): boolean {
  return revokeEvaluatorRefusal(view) === null
}
