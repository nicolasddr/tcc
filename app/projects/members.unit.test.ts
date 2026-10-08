import { describe, it, expect } from 'vitest'
import {
  aggregateStatus,
  groupMembers,
  participationByUser,
  type MemberRow,
} from './members'

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
    memberId: 'm1',
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

describe('participationByUser', () => {
  const row = (over: Partial<MemberRow>): MemberRow => ({
    memberId: 'm1',
    userId: 'u1',
    role: 'evaluator',
    status: 'active',
    name: 'Ana',
    email: 'ana@ex.com',
    ...over,
  })

  it('avaliador com rodadas ganha o rótulo agrupado por fase', () => {
    const result = participationByUser(
      [row({ memberId: 'm1', userId: 'u1' })],
      new Map([
        [
          'm1',
          [
            { roundNumber: 1, phase: 2 },
            { roundNumber: 2, phase: 3 },
          ],
        ],
      ]),
    )
    expect(result).toEqual({
      u1: {
        short: 'avaliou em 2 rodadas',
        full: 'avaliou nas rodadas 1 (Fase 2) e 2 (Fase 3)',
      },
    })
  })

  it('avaliador sem rodadas não tem chave', () => {
    const result = participationByUser(
      [
        row({ memberId: 'm1', userId: 'u1' }),
        row({ memberId: 'm2', userId: 'u2', name: 'Carla' }),
      ],
      new Map([['m1', [{ roundNumber: 3, phase: 2 }]]]),
    )
    expect(result).toEqual({
      u1: { short: 'avaliou em 1 rodada', full: 'avaliou na rodada 3 (Fase 2)' },
    })
  })

  it('só o vínculo de avaliador conta: a linha de administrador é ignorada', () => {
    const result = participationByUser(
      [row({ memberId: 'm1', userId: 'u1', role: 'administrator' })],
      new Map([['m1', [{ roundNumber: 1, phase: 2 }]]]),
    )
    expect(result).toEqual({})
  })

  it('o Administrador-avaliador ganha a marca pelo vínculo de avaliador', () => {
    const result = participationByUser(
      [
        row({ memberId: 'm-admin', userId: 'u1', role: 'administrator' }),
        row({ memberId: 'm-eval', userId: 'u1', role: 'evaluator' }),
      ],
      new Map([
        ['m-admin', [{ roundNumber: 1, phase: 2 }]],
        ['m-eval', [{ roundNumber: 2, phase: 3 }]],
      ]),
    )
    expect(result).toEqual({
      u1: { short: 'avaliou em 1 rodada', full: 'avaliou na rodada 2 (Fase 3)' },
    })
  })
})
