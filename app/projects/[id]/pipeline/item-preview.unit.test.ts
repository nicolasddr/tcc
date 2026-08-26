import { describe, it, expect } from 'vitest'
import { itemPreview, ITEM_PREVIEW_MAX } from './item-preview'

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
