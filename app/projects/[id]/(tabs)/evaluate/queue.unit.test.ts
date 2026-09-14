import { describe, it, expect } from 'vitest'
import {
  nextResponseId,
  pickResponseId,
} from '@/app/projects/[id]/(tabs)/evaluate/queue'

const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('app/projects/[id]/evaluate/queue — qual resposta a tela abre', () => {
  it('sem resposta na rodada, não há o que abrir', () => {
    expect(pickResponseId([], [])).toBeNull()
  })

  it('sem pedido, abre a primeira ainda não avaliada', () => {
    expect(pickResponseId(queue, ['a'])).toBe('b')
    expect(pickResponseId(queue, ['a', 'b'])).toBe('c')
  })

  it('com tudo avaliado, abre a primeira da rodada em leitura', () => {
    expect(pickResponseId(queue, ['a', 'b', 'c'])).toBe('a')
  })

  it('o pedido da rota ganha da fila, mesmo já avaliado', () => {
    expect(pickResponseId(queue, [], 'c')).toBe('c')
    expect(pickResponseId(queue, ['c'], 'c')).toBe('c')
  })

  it('pedido que não é da rodada é ignorado, e a fila decide', () => {
    expect(pickResponseId(queue, ['a'], 'de-outra-rodada')).toBe('b')
    expect(pickResponseId(queue, ['a'], '')).toBe('b')
  })
})

describe('app/projects/[id]/evaluate/queue — qual resposta vem depois', () => {
  it('a próxima é a primeira ainda não avaliada que não é a corrente', () => {
    expect(nextResponseId(queue, [], 'a')).toBe('b')
    expect(nextResponseId(queue, ['b'], 'a')).toBe('c')
  })

  it('com tudo avaliado, não há próxima', () => {
    expect(nextResponseId(queue, ['a', 'b', 'c'], 'a')).toBeNull()
    expect(nextResponseId([{ id: 'a' }], ['a'], 'a')).toBeNull()
  })
})
