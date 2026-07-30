import { describe, it, expect } from 'vitest'
import { aggregateStatus, groupMembers, type MemberRow } from './members'

describe('aggregateStatus', () => {
  it('ativo se qualquer papel estiver ativo', () => {
    expect(aggregateStatus(['inactive', 'active'])).toBe('active')
  })
  it('pendente quando não há ativo, mas há onboarding pendente', () => {
    expect(aggregateStatus(['inactive', 'pending_onboarding'])).toBe('pending_onboarding')
  })
  it('inativo quando não há ativo nem pendente', () => {
    expect(aggregateStatus(['inactive'])).toBe('inactive')
  })
  it('lista vazia é inativo', () => {
    expect(aggregateStatus([])).toBe('inactive')
  })
})

describe('groupMembers', () => {
  const row = (over: Partial<MemberRow>): MemberRow => ({
    userId: 'u1',
    role: 'evaluator',
    status: 'active',
    name: 'Ana',
    email: 'ana@ex.com',
    ...over,
  })

  it('une papéis do mesmo usuário numa linha só (admin-avaliador — HU-024)', () => {
    const result = groupMembers([
      row({ userId: 'u1', role: 'administrator', status: 'active' }),
      row({ userId: 'u1', role: 'evaluator', status: 'pending_onboarding' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].roles).toEqual(['administrator', 'evaluator'])
  })

  it('agrega o status do usuário a partir das linhas', () => {
    const result = groupMembers([
      row({ userId: 'u1', role: 'administrator', status: 'active' }),
      row({ userId: 'u1', role: 'evaluator', status: 'pending_onboarding' }),
    ])
    expect(result[0].status).toBe('active')
  })

  it('ordena por nome em PT-BR', () => {
    const result = groupMembers([
      row({ userId: 'u2', name: 'Ábner', email: 'a@ex.com' }),
      row({ userId: 'u1', name: 'Bruno', email: 'b@ex.com' }),
    ])
    expect(result.map((m) => m.name)).toEqual(['Ábner', 'Bruno'])
  })

  it('não expõe o campo interno _statuses', () => {
    const [member] = groupMembers([row({})])
    expect(member).not.toHaveProperty('_statuses')
  })

  it('lista vazia devolve array vazio', () => {
    expect(groupMembers([])).toEqual([])
  })
})
