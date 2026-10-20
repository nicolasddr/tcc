import type { MembershipRow } from './evaluator-link'

export type RevokeAdminOutcome = 'keeps_evaluator' | 'loses_access'

export const GRANT_DENIED =
  'Apenas um administrador do projeto pode dar acesso de administrador.'

export const GRANT_NOT_ACTIVE_EVALUATOR =
  'Só quem participa do projeto como avaliador ativo pode virar administrador.'

export const GRANT_ALREADY_ADMIN = 'Essa pessoa já é administradora deste projeto.'

export const REVOKE_ADMIN_DENIED =
  'Apenas um administrador do projeto pode remover acesso de administrador.'

export const REVOKE_NOT_ADMIN = 'Essa pessoa não é administradora deste projeto.'

export const REVOKE_LAST_ADMIN =
  'O projeto precisa de pelo menos um administrador. Dê acesso a outra pessoa antes de remover este.'

const ADMIN_POWERS =
  'editar o codebook e o prompt, abrir e encerrar rodadas, avançar fases, convidar e desativar membros e dar ou remover acesso de administrador'

function hasActive(rows: readonly MembershipRow[], role: string): boolean {
  return rows.some((r) => r.role === role && r.status === 'active')
}

export function grantAdminRefusal({
  callerIsAdmin,
  target,
}: {
  callerIsAdmin: boolean
  target: readonly MembershipRow[]
}): string | null {
  if (!callerIsAdmin) return GRANT_DENIED
  if (hasActive(target, 'administrator')) return GRANT_ALREADY_ADMIN
  if (!hasActive(target, 'evaluator')) return GRANT_NOT_ACTIVE_EVALUATOR
  return null
}

export function revokeAdminRefusal({
  callerIsAdmin,
  targetIsAdmin,
  activeAdminCount,
}: {
  callerIsAdmin: boolean
  targetIsAdmin: boolean
  activeAdminCount: number
}): string | null {
  if (!callerIsAdmin) return REVOKE_ADMIN_DENIED
  if (!targetIsAdmin) return REVOKE_NOT_ADMIN
  if (activeAdminCount <= 1) return REVOKE_LAST_ADMIN
  return null
}

export function revokeAdminOutcome(targetRows: readonly MembershipRow[]): RevokeAdminOutcome {
  return hasActive(targetRows, 'evaluator') ? 'keeps_evaluator' : 'loses_access'
}

export function grantAdminConfirmationLines(name: string): string[] {
  return [
    `${name} passa a ter os mesmos poderes que você: ${ADMIN_POWERS}.`,
    `${name} passa a ver a concordância (ICR) de todas as rodadas. Se ainda for avaliar, considere marcá-la como outlier nas rodadas em que avaliar depois disso.`,
    `As avaliações que ${name} já enviou não mudam.`,
  ]
}

export function revokeAdminConfirmationLines({
  name,
  self,
  keepsEvaluator,
}: {
  name: string
  self: boolean
  keepsEvaluator: boolean
}): string[] {
  const subject = self ? 'Você' : name
  return [
    `${subject} deixa de ${ADMIN_POWERS}.`,
    keepsEvaluator
      ? `${subject} continua participando como avaliador(a), sem ver a concordância (ICR).`
      : `${subject} perde o acesso ao projeto.`,
    `As atas que ${self ? 'você' : name} já escreveu continuam visíveis, com a assinatura.`,
  ]
}
