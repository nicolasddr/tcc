import { describe, it, expect } from 'vitest'
import {
  waitingMessage,
  waitingState,
  type WaitingInputs,
} from '@/app/projects/[id]/(tabs)/evaluate/waiting'
import { PHASE_1, PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'

const definitions = [{ id: 'd1' }, { id: 'd2' }]
const criteria = [{ definitionId: 'd1' }, { definitionId: 'd2' }]

function inputs(overrides: Partial<WaitingInputs> = {}): WaitingInputs {
  return {
    phase: PHASE_2,
    definitions,
    criteria,
    openRound: { roundNumber: 1 },
    total: 3,
    evaluated: 1,
    ...overrides,
  }
}

describe('app/projects/[id]/evaluate/waiting — o que a tela espera', () => {
  it('com resposta pendente na rodada aberta, não há espera nenhuma', () => {
    expect(waitingState(inputs())).toBeNull()
  })

  it('sem rodada e com codebook incompleto, espera o codebook', () => {
    expect(
      waitingState(inputs({ openRound: null, criteria: [{ definitionId: 'd1' }] })),
    ).toEqual({ key: 'codebook' })
    expect(waitingState(inputs({ openRound: null, definitions: [], criteria: [] }))).toEqual(
      { key: 'codebook' },
    )
  })

  it('antes da Fase 2 a espera é o codebook, mesmo com codebook completo', () => {
    expect(waitingState(inputs({ openRound: null, phase: PHASE_1 }))).toEqual({
      key: 'codebook',
    })
  })

  it('um critério geral basta para o codebook contar como completo', () => {
    expect(
      waitingState(inputs({ openRound: null, criteria: [{ definitionId: null }] })),
    ).toEqual({ key: 'round' })
  })

  it('sem rodada e com codebook completo, espera a rodada', () => {
    expect(waitingState(inputs({ openRound: null }))).toEqual({ key: 'round' })
  })

  it('com rodada aberta e nenhuma resposta, espera as respostas', () => {
    expect(waitingState(inputs({ total: 0, evaluated: 0 }))).toEqual({
      key: 'responses',
      roundNumber: 1,
    })
  })

  it('com tudo avaliado por mim, a espera é o fechamento da rodada', () => {
    expect(waitingState(inputs({ total: 3, evaluated: 3, openRound: { roundNumber: 4 } }))).toEqual(
      { key: 'finished', roundNumber: 4, total: 3 },
    )
  })

  it('rodada aberta com codebook incompleto NÃO cai na espera do codebook', () => {
    expect(waitingState(inputs({ definitions: [], criteria: [] }))).toBeNull()
    expect(waitingState(inputs({ definitions: [], criteria: [], total: 0 }))).toEqual({
      key: 'responses',
      roundNumber: 1,
    })
  })

  it('a rodada aberta e vazia vem antes de dizer que terminei', () => {
    expect(waitingState(inputs({ total: 0, evaluated: 0 }))).toEqual({
      key: 'responses',
      roundNumber: 1,
    })
  })
})

describe('app/projects/[id]/evaluate/waiting — a redação de cada espera', () => {
  it('cada espera diz de quem é a vez', () => {
    expect(waitingMessage({ key: 'codebook' })).toContain('montando o codebook')
    expect(waitingMessage({ key: 'round' })).toContain('abrir uma rodada')
    expect(waitingMessage({ key: 'responses', roundNumber: 2 })).toContain(
      'gerar as respostas',
    )
    expect(waitingMessage({ key: 'responses', roundNumber: 2 })).toContain('rodada 2')
  })

  it('o fim da fila conta o que eu avaliei e diz que a rodada aguarda fechamento', () => {
    expect(waitingMessage({ key: 'finished', roundNumber: 3, total: 1 })).toContain(
      '1 resposta avaliada',
    )
    expect(waitingMessage({ key: 'finished', roundNumber: 3, total: 5 })).toContain(
      '5 respostas avaliadas',
    )
    expect(waitingMessage({ key: 'finished', roundNumber: 3, total: 5 })).toContain(
      'fechamento',
    )
  })
})
