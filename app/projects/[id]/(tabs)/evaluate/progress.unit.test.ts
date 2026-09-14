import { describe, it, expect } from 'vitest'
import { progressMessage } from '@/app/projects/[id]/(tabs)/evaluate/progress'

describe('app/projects/[id]/evaluate/progress — o quanto falta para mim', () => {
  it('com uma resposta só na rodada, o total fica no singular', () => {
    expect(progressMessage({ evaluated: 0, total: 1 })).toContain('0 de 1 resposta avaliada')
  })

  it('com mais de uma, o total fica no plural', () => {
    expect(progressMessage({ evaluated: 1, total: 4 })).toContain(
      '1 de 4 respostas avaliadas',
    )
  })

  it('sem nenhuma avaliada, a contagem começa em zero', () => {
    expect(progressMessage({ evaluated: 0, total: 6 })).toContain(
      '0 de 6 respostas avaliadas',
    )
  })

  it('com tudo avaliado, a contagem alcança o total', () => {
    expect(progressMessage({ evaluated: 3, total: 3 })).toContain(
      '3 de 3 respostas avaliadas',
    )
  })

  it('a contagem é minha, e avisa que o total pode crescer', () => {
    const message = progressMessage({ evaluated: 2, total: 5 })

    expect(message).toContain('por você')
    expect(message).toContain('pode crescer')
  })
})
