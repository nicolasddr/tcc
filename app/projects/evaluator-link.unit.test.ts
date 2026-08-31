import { describe, it, expect } from 'vitest'
import {
  ASSUME_ALREADY_EVALUATOR,
  ASSUME_DENIED,
  REVOKE_DENIED,
  REVOKE_EVALUATIONS_SUBMITTED,
  REVOKE_NO_LINK,
  SUBMITTED_EVALUATIONS_UNTIL_EPICO_2,
  assumeEvaluatorRefusal,
  canAssumeEvaluatorRole,
  canRevokeEvaluatorRole,
  evaluatorLinkOf,
  revokeEvaluatorRefusal,
  type EvaluatorLink,
} from './evaluator-link'

const admin = { role: 'administrator', status: 'active' }
const pendingEvaluator = { role: 'evaluator', status: 'pending_onboarding' }
const activeEvaluator = { role: 'evaluator', status: 'active' }

const link = (over: Partial<EvaluatorLink> = {}): EvaluatorLink => ({
  status: 'active',
  submittedEvaluations: SUBMITTED_EVALUATIONS_UNTIL_EPICO_2,
  ...over,
})

describe('evaluatorLinkOf', () => {
  it('devolve null para quem só tem o vínculo de administrador', () => {
    expect(evaluatorLinkOf([admin])).toBeNull()
  })

  it('encontra o vínculo de avaliador ao lado do de administrador', () => {
    expect(evaluatorLinkOf([admin, pendingEvaluator])).toEqual({
      status: 'pending_onboarding',
      submittedEvaluations: 0,
    })
  })

  it('preserva a contagem de avaliações enviadas informada', () => {
    expect(evaluatorLinkOf([admin, activeEvaluator], 3)?.submittedEvaluations).toBe(3)
  })

  it('lista vazia devolve null', () => {
    expect(evaluatorLinkOf([])).toBeNull()
  })
})

describe('assumeEvaluatorRefusal', () => {
  it('recusa quem não é administrador do projeto', () => {
    expect(assumeEvaluatorRefusal({ isAdmin: false, link: null })).toBe(ASSUME_DENIED)
    expect(canAssumeEvaluatorRole({ isAdmin: false, link: null })).toBe(false)
  })

  it('recusa quem já tem o vínculo de avaliador, em qualquer status', () => {
    for (const status of ['pending_onboarding', 'active', 'inactive'] as const) {
      expect(assumeEvaluatorRefusal({ isAdmin: true, link: link({ status }) })).toBe(
        ASSUME_ALREADY_EVALUATOR,
      )
    }
  })

  it('libera o administrador que ainda não é avaliador', () => {
    expect(assumeEvaluatorRefusal({ isAdmin: true, link: null })).toBeNull()
    expect(canAssumeEvaluatorRole({ isAdmin: true, link: null })).toBe(true)
  })
})

describe('revokeEvaluatorRefusal', () => {
  it('recusa quem não é administrador do projeto', () => {
    expect(revokeEvaluatorRefusal({ isAdmin: false, link: link() })).toBe(REVOKE_DENIED)
  })

  it('recusa quem não tem vínculo de avaliador para desfazer', () => {
    expect(revokeEvaluatorRefusal({ isAdmin: true, link: null })).toBe(REVOKE_NO_LINK)
  })

  it('recusa depois da primeira avaliação enviada', () => {
    const view = { isAdmin: true, link: link({ submittedEvaluations: 1 }) }
    expect(revokeEvaluatorRefusal(view)).toBe(REVOKE_EVALUATIONS_SUBMITTED)
    expect(canRevokeEvaluatorRole(view)).toBe(false)
  })

  it('libera enquanto nenhuma avaliação foi enviada, pendente ou ativo', () => {
    for (const status of ['pending_onboarding', 'active'] as const) {
      expect(canRevokeEvaluatorRole({ isAdmin: true, link: link({ status }) })).toBe(true)
    }
  })
})
