import { describe, it, expect } from 'vitest'
import { roleLabel, projectStatusLabel, memberStatusLabel } from './labels'

describe('roleLabel', () => {
  it('traduz os papéis conhecidos', () => {
    expect(roleLabel('administrator')).toBe('Administrador')
    expect(roleLabel('evaluator')).toBe('Avaliador')
  })
  it('devolve o próprio código quando desconhecido', () => {
    expect(roleLabel('outro')).toBe('outro')
  })
})

describe('projectStatusLabel', () => {
  it('traduz os status de projeto conhecidos', () => {
    expect(projectStatusLabel('active')).toBe('Ativo')
    expect(projectStatusLabel('completed')).toBe('Concluído')
    expect(projectStatusLabel('archived')).toBe('Arquivado')
  })
  it('devolve o próprio código quando desconhecido', () => {
    expect(projectStatusLabel('foo')).toBe('foo')
  })
})

describe('memberStatusLabel', () => {
  it('traduz os status de membro conhecidos', () => {
    expect(memberStatusLabel('active')).toBe('Ativo')
    expect(memberStatusLabel('pending_onboarding')).toBe('Onboarding pendente')
    expect(memberStatusLabel('inactive')).toBe('Inativo')
  })
  it('devolve o próprio código quando desconhecido', () => {
    expect(memberStatusLabel('foo')).toBe('foo')
  })
})
