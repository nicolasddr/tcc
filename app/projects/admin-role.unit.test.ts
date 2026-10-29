import { describe, it, expect } from 'vitest'
import {
  GRANT_ALREADY_ADMIN,
  GRANT_DENIED,
  GRANT_NOT_ACTIVE_EVALUATOR,
  REVOKE_ADMIN_DENIED,
  REVOKE_LAST_ADMIN,
  REVOKE_NOT_ADMIN,
  grantAdminConfirmationLines,
  grantAdminRefusal,
  revokeAdminConfirmationLines,
  revokeAdminOutcome,
  revokeAdminRefusal,
} from './admin-role'

const activeAdmin = { role: 'administrator', status: 'active' }
const inactiveAdmin = { role: 'administrator', status: 'inactive' }
const activeEvaluator = { role: 'evaluator', status: 'active' }
const pendingEvaluator = { role: 'evaluator', status: 'pending_onboarding' }
const inactiveEvaluator = { role: 'evaluator', status: 'inactive' }

describe('grantAdminRefusal', () => {
  it('recusa quem não é administrador do projeto', () => {
    expect(grantAdminRefusal({ callerIsAdmin: false, target: [activeEvaluator] })).toBe(
      GRANT_DENIED,
    )
  })

  it('recusa alvo em onboarding, desativado ou sem vínculo de avaliador', () => {
    for (const target of [[pendingEvaluator], [inactiveEvaluator], []]) {
      expect(grantAdminRefusal({ callerIsAdmin: true, target })).toBe(
        GRANT_NOT_ACTIVE_EVALUATOR,
      )
    }
  })

  it('recusa alvo que já é administrador ativo, com ou sem vínculo de avaliador', () => {
    expect(
      grantAdminRefusal({ callerIsAdmin: true, target: [activeAdmin, activeEvaluator] }),
    ).toBe(GRANT_ALREADY_ADMIN)
    expect(grantAdminRefusal({ callerIsAdmin: true, target: [activeAdmin] })).toBe(
      GRANT_ALREADY_ADMIN,
    )
  })

  it('aceita avaliador ativo sem vínculo de administrador', () => {
    expect(grantAdminRefusal({ callerIsAdmin: true, target: [activeEvaluator] })).toBeNull()
  })

  it('aceita a re-promoção de quem tem a linha de administrador inativa', () => {
    expect(
      grantAdminRefusal({ callerIsAdmin: true, target: [inactiveAdmin, activeEvaluator] }),
    ).toBeNull()
  })
})

describe('revokeAdminRefusal', () => {
  it('recusa quem não é administrador do projeto', () => {
    expect(
      revokeAdminRefusal({ callerIsAdmin: false, targetIsAdmin: true, activeAdminCount: 2 }),
    ).toBe(REVOKE_ADMIN_DENIED)
  })

  it('recusa alvo que não é administrador', () => {
    expect(
      revokeAdminRefusal({ callerIsAdmin: true, targetIsAdmin: false, activeAdminCount: 2 }),
    ).toBe(REVOKE_NOT_ADMIN)
  })

  it('recusa remover o último administrador ativo', () => {
    for (const activeAdminCount of [1, 0]) {
      expect(
        revokeAdminRefusal({ callerIsAdmin: true, targetIsAdmin: true, activeAdminCount }),
      ).toBe(REVOKE_LAST_ADMIN)
    }
  })

  it('aceita remover a si mesmo quando há outro administrador ativo', () => {
    expect(
      revokeAdminRefusal({ callerIsAdmin: true, targetIsAdmin: true, activeAdminCount: 2 }),
    ).toBeNull()
  })
})

describe('revokeAdminOutcome', () => {
  it('quem tem vínculo de avaliador ativo continua no projeto', () => {
    expect(revokeAdminOutcome([activeAdmin, activeEvaluator])).toBe('keeps_evaluator')
  })

  it('quem só tem o vínculo de administrador perde o acesso', () => {
    expect(revokeAdminOutcome([activeAdmin])).toBe('loses_access')
  })

  it('vínculo de avaliador inativo ou em onboarding não mantém o acesso', () => {
    expect(revokeAdminOutcome([activeAdmin, inactiveEvaluator])).toBe('loses_access')
    expect(revokeAdminOutcome([activeAdmin, pendingEvaluator])).toBe('loses_access')
  })
})

describe('grantAdminConfirmationLines', () => {
  it('diz os poderes, a exposição ao ICR e que as avaliações enviadas não mudam', () => {
    expect(grantAdminConfirmationLines('Ana')).toEqual([
      'Ana passa a ter os mesmos poderes que você: editar o codebook e o prompt, abrir e encerrar rodadas, avançar fases, convidar e desativar membros e dar ou remover acesso de administrador.',
      'Ana passa a ver a concordância e a confiabilidade (ICR) de todas as rodadas. Se ainda for avaliar, considere marcá-la como outlier nas rodadas em que avaliar depois disso.',
      'As avaliações que Ana já enviou não mudam.',
    ])
  })
})

describe('revokeAdminConfirmationLines', () => {
  it('outra pessoa que continua como avaliadora', () => {
    expect(
      revokeAdminConfirmationLines({ name: 'Ana', self: false, keepsEvaluator: true }),
    ).toEqual([
      'Ana deixa de editar o codebook e o prompt, abrir e encerrar rodadas, avançar fases, convidar e desativar membros e dar ou remover acesso de administrador.',
      'Ana continua participando como avaliador(a), sem ver a concordância e a confiabilidade (ICR).',
      'As atas que Ana já escreveu continuam visíveis, com a assinatura.',
    ])
  })

  it('outra pessoa que perde o acesso', () => {
    expect(
      revokeAdminConfirmationLines({ name: 'Ana', self: false, keepsEvaluator: false }),
    ).toEqual([
      'Ana deixa de editar o codebook e o prompt, abrir e encerrar rodadas, avançar fases, convidar e desativar membros e dar ou remover acesso de administrador.',
      'Ana perde o acesso ao projeto.',
      'As atas que Ana já escreveu continuam visíveis, com a assinatura.',
    ])
  })

  it('a si mesmo, continuando como avaliador', () => {
    expect(
      revokeAdminConfirmationLines({ name: 'Ana', self: true, keepsEvaluator: true }),
    ).toEqual([
      'Você deixa de editar o codebook e o prompt, abrir e encerrar rodadas, avançar fases, convidar e desativar membros e dar ou remover acesso de administrador.',
      'Você continua participando como avaliador(a), sem ver a concordância e a confiabilidade (ICR).',
      'As atas que você já escreveu continuam visíveis, com a assinatura.',
    ])
  })

  it('a si mesmo, perdendo o acesso', () => {
    expect(
      revokeAdminConfirmationLines({ name: 'Ana', self: true, keepsEvaluator: false }),
    ).toEqual([
      'Você deixa de editar o codebook e o prompt, abrir e encerrar rodadas, avançar fases, convidar e desativar membros e dar ou remover acesso de administrador.',
      'Você perde o acesso ao projeto.',
      'As atas que você já escreveu continuam visíveis, com a assinatura.',
    ])
  })
})
