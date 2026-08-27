import { describe, it, expect } from 'vitest'
import { moveBy } from './reorder'

describe('moveBy', () => {
  it('sobe um item uma posição', () => {
    expect(moveBy(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
  })

  it('desce um item uma posição', () => {
    expect(moveBy(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })

  it('move mais de uma posição de uma vez', () => {
    expect(moveBy(['a', 'b', 'c', 'd'], 3, -2)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('não sai da lista: subir o primeiro e descer o último não muda nada', () => {
    expect(moveBy(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveBy(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })

  it('índice fora da lista não muda nada', () => {
    expect(moveBy(['a', 'b'], 5, -1)).toEqual(['a', 'b'])
    expect(moveBy(['a', 'b'], -1, 1)).toEqual(['a', 'b'])
  })

  it('não altera a lista original', () => {
    const original = ['a', 'b', 'c']
    moveBy(original, 0, 1)
    expect(original).toEqual(['a', 'b', 'c'])
  })

  it('mover não perde nem duplica item', () => {
    const moved = moveBy(['a', 'b', 'c', 'd'], 0, 3)
    expect(moved).toHaveLength(4)
    expect([...moved].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('offset zero devolve a mesma ordem', () => {
    expect(moveBy(['a', 'b', 'c'], 1, 0)).toEqual(['a', 'b', 'c'])
  })
})
