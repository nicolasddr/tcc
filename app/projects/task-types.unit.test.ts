import { describe, it, expect } from 'vitest'
import { normalizeTaskType, taskTypeLabel } from './task-types'

describe('normalizeTaskType', () => {
  it('mantém um código válido', () => {
    expect(normalizeTaskType('classification')).toBe('classification')
  })
  it('vira null para código desconhecido', () => {
    expect(normalizeTaskType('qualquer-coisa')).toBeNull()
  })
  it('vira null para vazio, null e undefined', () => {
    expect(normalizeTaskType('')).toBeNull()
    expect(normalizeTaskType(null)).toBeNull()
    expect(normalizeTaskType(undefined)).toBeNull()
  })
})

describe('taskTypeLabel', () => {
  it('devolve o rótulo (PT) de um código salvo', () => {
    expect(taskTypeLabel('quality_evaluation')).toBe('Avaliação de qualidade')
  })
  it('devolve null quando não há tipo declarado', () => {
    expect(taskTypeLabel(null)).toBeNull()
    expect(taskTypeLabel('desconhecido')).toBeNull()
  })
})
