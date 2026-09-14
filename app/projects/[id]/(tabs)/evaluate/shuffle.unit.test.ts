import { describe, it, expect } from 'vitest'
import { hash32, orderKey } from '@/app/projects/[id]/(tabs)/evaluate/shuffle'

const member = '11111111-1111-4111-8111-111111111111'
const round = '22222222-2222-4222-8222-222222222222'
const response = '33333333-3333-4333-8333-333333333333'

function id(index: number): string {
  return `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`
}

describe('app/projects/[id]/evaluate/shuffle — a chave que embaralha', () => {
  it('a mesma entrada dá sempre a mesma chave, entre chamadas', () => {
    expect(orderKey(member, round, response)).toBe(orderKey(member, round, response))
    expect(hash32('texto')).toBe(hash32('texto'))
  })

  it('a chave é um inteiro de 32 bits sem sinal', () => {
    for (let index = 0; index < 200; index += 1) {
      const key = orderKey(member, round, id(index))
      expect(Number.isInteger(key)).toBe(true)
      expect(key).toBeGreaterThanOrEqual(0)
      expect(key).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('a chave muda com o vínculo, então cada avaliador tem a sua ordem', () => {
    const other = '55555555-5555-4555-8555-555555555555'

    expect(orderKey(member, round, response)).not.toBe(orderKey(other, round, response))
  })

  it('a chave muda com a rodada, então a ordem não se repete de rodada em rodada', () => {
    const other = '66666666-6666-4666-8666-666666666666'

    expect(orderKey(member, round, response)).not.toBe(orderKey(member, other, response))
  })

  it('ids que só diferem no fim ainda embaralham diferente para cada vínculo', () => {
    const other = '55555555-5555-4555-8555-555555555555'
    const ids = Array.from({ length: 8 }, (_, index) => id(index))
    const order = (who: string) =>
      [...ids].sort((a, b) => orderKey(who, round, a) - orderKey(who, round, b))

    expect(order(member)).not.toEqual(order(other))
  })

  it('num lote realista de respostas, nenhuma chave colide com outra', () => {
    const keys = new Set<number>()
    for (let index = 0; index < 500; index += 1) {
      keys.add(orderKey(member, round, id(index)))
    }

    expect(keys.size).toBe(500)
  })
})
