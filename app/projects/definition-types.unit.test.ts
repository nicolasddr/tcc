import { describe, it, expect } from 'vitest'
import {
  DEFINITION_TYPE_OPTIONS,
  defaultDefinitionType,
  definitionTypeLabel,
  normalizeDefinitionType,
} from './definition-types'
import { TASK_TYPE_OPTIONS } from './task-types'

describe('DEFINITION_TYPE_OPTIONS', () => {
  it('oferece exatamente os três tipos do glossário, com esses nomes', () => {
    expect(DEFINITION_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      'category',
      'quality_dimension',
      'generated_content',
    ])
    expect(DEFINITION_TYPE_OPTIONS.map((o) => o.label)).toEqual([
      'Categoria',
      'Dimensão de qualidade',
      'Conteúdo gerado',
    ])
  })

  it('dá a cada tipo uma explicação curta para a tela', () => {
    for (const option of DEFINITION_TYPE_OPTIONS) {
      expect(option.hint.trim()).not.toBe('')
    }
  })
})

describe('normalizeDefinitionType', () => {
  it('aceita os três tipos válidos', () => {
    expect(normalizeDefinitionType('category')).toBe('category')
    expect(normalizeDefinitionType('quality_dimension')).toBe('quality_dimension')
    expect(normalizeDefinitionType('generated_content')).toBe('generated_content')
  })

  it('devolve null para valor ausente, vazio ou desconhecido', () => {
    expect(normalizeDefinitionType(null)).toBeNull()
    expect(normalizeDefinitionType(undefined)).toBeNull()
    expect(normalizeDefinitionType('')).toBeNull()
    expect(normalizeDefinitionType('categoria')).toBeNull()
    expect(normalizeDefinitionType('classification')).toBeNull()
  })
})

describe('definitionTypeLabel', () => {
  it('traduz o código salvo para o rótulo da UI', () => {
    expect(definitionTypeLabel('category')).toBe('Categoria')
    expect(definitionTypeLabel('quality_dimension')).toBe('Dimensão de qualidade')
    expect(definitionTypeLabel('generated_content')).toBe('Conteúdo gerado')
  })

  it('devolve null para código desconhecido ou ausente', () => {
    expect(definitionTypeLabel(null)).toBeNull()
    expect(definitionTypeLabel('outro')).toBeNull()
  })
})

describe('defaultDefinitionType', () => {
  it('pré-seleciona o tipo conforme o tipo de tarefa declarado no projeto', () => {
    expect(defaultDefinitionType('classification')).toBe('category')
    expect(defaultDefinitionType('quality_evaluation')).toBe('quality_dimension')
    expect(defaultDefinitionType('generation')).toBe('generated_content')
  })

  it('abre sem pré-seleção em projeto sem tipo, misto ou outro', () => {
    expect(defaultDefinitionType(null)).toBeNull()
    expect(defaultDefinitionType(undefined)).toBeNull()
    expect(defaultDefinitionType('mixed')).toBeNull()
    expect(defaultDefinitionType('other')).toBeNull()
  })

  it('mapeia só tipos de tarefa que existem de verdade', () => {
    const taskTypes = TASK_TYPE_OPTIONS.map((o) => o.value) as readonly string[]
    for (const taskType of ['classification', 'quality_evaluation', 'generation']) {
      expect(taskTypes).toContain(taskType)
    }
    expect(defaultDefinitionType('inexistente')).toBeNull()
  })
})
