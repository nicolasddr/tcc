import { describe, it, expect } from 'vitest'
import {
  buildQueue,
  pickResponseId,
} from '@/app/projects/[id]/(tabs)/evaluate/queue'

const round = '22222222-2222-4222-8222-222222222222'
const member = '11111111-1111-4111-8111-111111111111'
const colleague = '55555555-5555-4555-8555-555555555555'

function response(index: number): { id: string } {
  return { id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}` }
}

const responses = Array.from({ length: 8 }, (_, index) => response(index))

function order(queue: readonly { id: string }[]): string[] {
  return queue.map((item) => item.id)
}

function labelOf(queue: readonly { id: string; label: string }[], id: string): string {
  return queue.find((item) => item.id === id)!.label
}

describe('app/projects/[id]/evaluate/queue — a fila do avaliador', () => {
  it('com as mesmas entradas, a fila é a mesma entre visitas', () => {
    expect(order(buildQueue(responses, [], member, round))).toEqual(
      order(buildQueue(responses, [], member, round)),
    )
  })

  it('a fila leva todas as respostas da rodada, sem perder nem repetir', () => {
    const queue = buildQueue(responses, [], member, round)

    expect(queue).toHaveLength(responses.length)
    expect(new Set(order(queue))).toEqual(new Set(responses.map((r) => r.id)))
  })

  it('dois avaliadores recebem ordens diferentes sobre as mesmas respostas', () => {
    expect(order(buildQueue(responses, [], member, round))).not.toEqual(
      order(buildQueue(responses, [], colleague, round)),
    )
  })

  it('acrescentar uma resposta não muda a posição relativa das anteriores', () => {
    const before = order(buildQueue(responses, [], member, round))
    const grown = order(buildQueue([...responses, response(99)], [], member, round))

    expect(grown.filter((id) => id !== response(99).id)).toEqual(before)
  })

  it('o rótulo segue a ordem canônica, e não a posição na fila', () => {
    const queue = buildQueue(responses, [], member, round)

    expect(labelOf(queue, responses[0].id)).toBe('Resposta 1')
    expect(labelOf(queue, responses[2].id)).toBe('Resposta 3')
    expect(queue.map((item) => item.label)).not.toEqual([
      'Resposta 1',
      'Resposta 2',
      'Resposta 3',
      'Resposta 4',
      'Resposta 5',
      'Resposta 6',
      'Resposta 7',
      'Resposta 8',
    ])
  })

  it('o rótulo de uma resposta é o mesmo para dois avaliadores', () => {
    const mine = buildQueue(responses, [], member, round)
    const theirs = buildQueue(responses, [], colleague, round)

    for (const { id } of responses) {
      expect(labelOf(mine, id)).toBe(labelOf(theirs, id))
    }
  })

  it('a fila marca o que eu já avaliei, e só o que eu avaliei', () => {
    const queue = buildQueue(responses, [responses[3].id], member, round)

    expect(queue.filter((item) => item.evaluated).map((item) => item.id)).toEqual([
      responses[3].id,
    ])
  })
})

describe('app/projects/[id]/evaluate/queue — qual resposta a tela abre', () => {
  const queue = buildQueue(responses, [], member, round)

  it('sem resposta na rodada, não há o que abrir', () => {
    expect(pickResponseId([])).toBeNull()
  })

  it('sem pedido, abre a primeira ainda não avaliada DA FILA', () => {
    const evaluated = [queue[0].id, queue[1].id]

    expect(pickResponseId(buildQueue(responses, evaluated, member, round))).toBe(
      queue[2].id,
    )
  })

  it('com tudo avaliado, abre a primeira da fila em leitura', () => {
    const all = responses.map((r) => r.id)

    expect(pickResponseId(buildQueue(responses, all, member, round))).toBe(queue[0].id)
  })

  it('o pedido da rota ganha da fila, mesmo já avaliado', () => {
    const asked = responses[5].id
    const evaluated = buildQueue(responses, [asked], member, round)

    expect(pickResponseId(queue, asked)).toBe(asked)
    expect(pickResponseId(evaluated, asked)).toBe(asked)
  })

  it('pedido que não é da rodada é ignorado, e a fila decide', () => {
    expect(pickResponseId(queue, 'de-outra-rodada')).toBe(queue[0].id)
    expect(pickResponseId(queue, '')).toBe(queue[0].id)
  })
})
