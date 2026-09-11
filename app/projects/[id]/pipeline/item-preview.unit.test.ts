import { describe, it, expect } from 'vitest'
import {
  itemPreview,
  itemPreviewLines,
  ITEM_PREVIEW_LINES,
  ITEM_PREVIEW_MAX,
} from './item-preview'

describe('itemPreview', () => {
  it('devolve o conteúdo curto inteiro, sem reticências', () => {
    expect(itemPreview('como fazer bolo de cenoura')).toBe('como fazer bolo de cenoura')
  })

  it('achata quebras de linha e espaços repetidos numa linha só', () => {
    expect(itemPreview('primeira linha\n\n  segunda   linha\t\tterceira')).toBe(
      'primeira linha segunda linha terceira',
    )
  })

  it('corta o conteúdo longo no limite e marca com reticências', () => {
    const preview = itemPreview('a'.repeat(ITEM_PREVIEW_MAX + 50))
    expect(preview).toHaveLength(ITEM_PREVIEW_MAX + 1)
    expect(preview.endsWith('…')).toBe(true)
  })

  it('não deixa espaço solto antes das reticências', () => {
    expect(itemPreview('palavra '.repeat(40), 8)).toBe('palavra…')
  })

  it('não corta quando o conteúdo tem exatamente o limite', () => {
    const exact = 'a'.repeat(ITEM_PREVIEW_MAX)
    expect(itemPreview(exact)).toBe(exact)
  })
})

describe('itemPreviewLines', () => {
  it('devolve o conteúdo de uma linha inteiro, sem reticências', () => {
    expect(itemPreviewLines('como fazer bolo de cenoura')).toBe(
      'como fazer bolo de cenoura',
    )
  })

  it('preserva as quebras de linha e descarta as linhas em branco', () => {
    expect(itemPreviewLines('primeira linha\n\n  segunda   linha\t\tfim')).toBe(
      'primeira linha\nsegunda linha fim',
    )
  })

  it('corta pelo número de linhas e marca com reticências', () => {
    const content = ['um', 'dois', 'três', 'quatro'].join('\n')
    expect(itemPreviewLines(content, 2)).toBe('um\ndois…')
  })

  it('não marca reticências quando as linhas cabem no limite', () => {
    const content = ['um', 'dois'].join('\n')
    expect(itemPreviewLines(content, 2)).toBe('um\ndois')
  })

  it('corta por caracteres antes do limite de linhas', () => {
    const content = ['a'.repeat(100), 'b'.repeat(100), 'c'.repeat(100)].join('\n')
    const preview = itemPreviewLines(content, ITEM_PREVIEW_LINES, 50)
    expect(preview).toBe(`${'a'.repeat(50)}…`)
  })

  it('não deixa espaço solto antes das reticências', () => {
    expect(itemPreviewLines('palavra '.repeat(40), 1, 8)).toBe('palavra…')
  })

  it('usa o mesmo limite de caracteres da prévia achatada por padrão', () => {
    const preview = itemPreviewLines('a'.repeat(ITEM_PREVIEW_MAX + 50))
    expect(preview).toHaveLength(ITEM_PREVIEW_MAX + 1)
    expect(preview.endsWith('…')).toBe(true)
  })
})
