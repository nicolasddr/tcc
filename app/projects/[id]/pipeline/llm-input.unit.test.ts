import { describe, it, expect } from 'vitest'
import {
  composeLlmInput,
  DEFINITIONS_HEADING,
  ITEM_HEADING,
  type LlmInputParts,
} from './llm-input'

const PARTS: LlmInputParts = {
  promptText: 'Classifique a consulta de busca abaixo.',
  definitionTitles: ['Navegacional', 'Informacional', 'Transacional'],
  itemContent: 'como fazer bolo de cenoura',
}

describe('composeLlmInput', () => {
  it('envia o prompt, os títulos das definições e o conteúdo do item, nessa ordem', () => {
    const input = composeLlmInput(PARTS)
    expect(input.indexOf(PARTS.promptText)).toBe(0)
    expect(input.indexOf(DEFINITIONS_HEADING)).toBeGreaterThan(0)
    expect(input.indexOf(ITEM_HEADING)).toBeGreaterThan(input.indexOf(DEFINITIONS_HEADING))
    expect(input.indexOf(PARTS.itemContent)).toBeGreaterThan(input.indexOf(ITEM_HEADING))
  })

  it('preserva a ordem salva das definições', () => {
    const input = composeLlmInput(PARTS)
    const positions = PARTS.definitionTitles.map((title) => input.indexOf(title))
    expect(positions.every((position) => position > 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)

    const reversed = composeLlmInput({
      ...PARTS,
      definitionTitles: [...PARTS.definitionTitles].reverse(),
    })
    expect(reversed.indexOf('Transacional')).toBeLessThan(reversed.indexOf('Navegacional'))
  })

  it('leva só os títulos: nenhuma descrição e nenhum critério entram no envio', () => {
    const input = composeLlmInput(PARTS)
    expect(input).not.toContain('descrição')
    expect(input).not.toContain('critério')
    const lines = input.split('\n').filter((line) => line.startsWith('- '))
    expect(lines).toEqual(['- Navegacional', '- Informacional', '- Transacional'])
  })

  it('preserva a formatação do prompt e a do item, sem normalizar', () => {
    const promptText = 'Primeira linha\n\n   linha recuada\n\tlinha com tabulação'
    const itemContent = 'linha 1\n\n\nlinha 4   com espaços no fim   '
    const input = composeLlmInput({ ...PARTS, promptText, itemContent })
    expect(input).toContain(promptText)
    expect(input).toContain(itemContent)
  })

  it('compõe o envio mesmo com uma definição só', () => {
    const input = composeLlmInput({ ...PARTS, definitionTitles: ['Navegacional'] })
    expect(input).toContain(`${DEFINITIONS_HEADING}\n- Navegacional`)
  })
})
