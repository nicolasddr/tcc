import { describe, it, expect } from 'vitest'
import { itemUsageLabel } from './item-usage'

describe('itemUsageLabel', () => {
  it('não rotula o item que ainda não produziu resposta em rodada nenhuma', () => {
    expect(itemUsageLabel([])).toBeNull()
  })

  it('usa o singular quando o item foi usado em uma rodada só', () => {
    expect(itemUsageLabel([3])).toBe('usado na rodada 3')
  })

  it('lista as rodadas na ordem recebida quando são várias', () => {
    expect(itemUsageLabel([1, 3, 4])).toBe('usado nas rodadas 1, 3, 4')
  })
})
