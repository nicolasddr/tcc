import { describe, it, expect } from 'vitest'
import { accessRows, canViewProject } from './project-access'

const row = (role: string, status: string) => ({ role, status })

describe('canViewProject', () => {
  it('libera vínculo ativo ou em onboarding, de qualquer papel', () => {
    for (const status of ['active', 'pending_onboarding']) {
      for (const role of ['administrator', 'evaluator']) {
        expect(canViewProject({ memberships: [row(role, status)], hasInvitation: false })).toBe(
          true,
        )
      }
    }
  })

  it('barra quem só tem vínculo inativo, mesmo com mais de um papel', () => {
    expect(
      canViewProject({
        memberships: [row('administrator', 'inactive'), row('evaluator', 'inactive')],
        hasInvitation: false,
      }),
    ).toBe(false)
  })

  it('barra quem não tem vínculo nem convite', () => {
    expect(canViewProject({ memberships: [], hasInvitation: false })).toBe(false)
  })

  it('libera o convite pendente, com ou sem vínculo inativo', () => {
    expect(canViewProject({ memberships: [], hasInvitation: true })).toBe(true)
    expect(
      canViewProject({ memberships: [row('evaluator', 'inactive')], hasInvitation: true }),
    ).toBe(true)
  })

  it('libera quem tem um vínculo ativo ao lado de um inativo', () => {
    expect(
      canViewProject({
        memberships: [row('administrator', 'active'), row('evaluator', 'inactive')],
        hasInvitation: false,
      }),
    ).toBe(true)
  })
})

describe('accessRows', () => {
  it('fica só com os vínculos que dão acesso', () => {
    expect(
      accessRows([
        row('administrator', 'active'),
        row('evaluator', 'inactive'),
        row('evaluator', 'pending_onboarding'),
      ]),
    ).toEqual([row('administrator', 'active'), row('evaluator', 'pending_onboarding')])
  })
})
