import { describe, it, expect } from 'vitest'
import {
  waitingMessage,
  waitingState,
  type WaitingInputs,
} from '@/app/projects/[id]/(tabs)/evaluate/waiting'
import { PHASE_1, PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'

const definitions = [{ id: 'd1' }, { id: 'd2' }]
const criteria: WaitingInputs['criteria'] = [
  { definitionId: 'd1', scope: 'specific' },
  { definitionId: 'd2', scope: 'specific' },
]

function inputs(overrides: Partial<WaitingInputs> = {}): WaitingInputs {
  return {
    phase: PHASE_2,
    definitions,
    criteria,
    openRound: { roundNumber: 1 },
    total: 3,
    ...overrides,
  }
}

describe('app/projects/[id]/evaluate/waiting — o que a tela espera', () => {
  it('com resposta pendente na rodada aberta, não há espera nenhuma', () => {
    expect(waitingState(inputs())).toBeNull()
  })

  it('sem rodada e com codebook incompleto, espera o codebook', () => {
    expect(
      waitingState(
        inputs({ openRound: null, criteria: [{ definitionId: 'd1', scope: 'specific' }] }),
      ),
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
      waitingState(
        inputs({ openRound: null, criteria: [{ definitionId: null, scope: 'general' }] }),
      ),
    ).toEqual({ key: 'round' })
  })

  it('sem rodada e com codebook completo, espera a rodada', () => {
    expect(waitingState(inputs({ openRound: null }))).toEqual({ key: 'round' })
  })

  it('com rodada aberta e nenhuma resposta, espera as respostas', () => {
    expect(waitingState(inputs({ total: 0 }))).toEqual({
      key: 'responses',
      roundNumber: 1,
    })
  })

  it('rodada aberta com codebook incompleto NÃO cai na espera do codebook', () => {
    expect(waitingState(inputs({ definitions: [], criteria: [] }))).toBeNull()
    expect(waitingState(inputs({ definitions: [], criteria: [], total: 0 }))).toEqual({
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
})
