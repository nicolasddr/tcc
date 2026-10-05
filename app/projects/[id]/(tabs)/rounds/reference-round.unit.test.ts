import { describe, it, expect } from 'vitest'
import {
  projectReferenceRound,
  referenceRoundOf,
  referenceVersionsOf,
  versionChanges,
  versionChangesSentence,
} from '@/app/projects/[id]/(tabs)/rounds/reference-round'
import { ROUND_CLOSED, ROUND_OPEN } from '@/app/projects/[id]/(tabs)/rounds/round-status'
import { PHASE_2, PHASE_3, PHASE_4 } from '@/app/projects/[id]/pipeline/preconditions'

function round(roundNumber: number, phase: number, status: string = ROUND_CLOSED) {
  return {
    roundNumber,
    phase,
    status,
    codebookVersionNumber: roundNumber,
    promptVersionNumber: roundNumber + 10,
  }
}

function numberOf(found: { roundNumber: number } | null): number | null {
  return found?.roundNumber ?? null
}

describe('app/projects/[id]/rounds/reference-round — a rodada de referência', () => {
  it('é a fechada da Fase 3 de maior número no projeto, e a de maior número menor que a rodada', () => {
    const rounds = [
      round(1, PHASE_2),
      round(2, PHASE_3),
      round(3, PHASE_3),
      round(4, PHASE_3),
      round(5, PHASE_4),
    ]
    expect(numberOf(projectReferenceRound(rounds))).toBe(4)
    expect(numberOf(referenceRoundOf(rounds, { roundNumber: 5 }))).toBe(4)
    expect(numberOf(referenceRoundOf(rounds, { roundNumber: 4 }))).toBe(3)
  })

  it('não conta a rodada aberta da Fase 3', () => {
    const rounds = [round(2, PHASE_3), round(3, PHASE_3, ROUND_OPEN)]
    expect(numberOf(projectReferenceRound(rounds))).toBe(2)
    expect(numberOf(referenceRoundOf(rounds, { roundNumber: 4 }))).toBe(2)
  })

  it('não existe só com rodadas das Fases 2 e 4, nem sem rodada nenhuma', () => {
    const rounds = [round(1, PHASE_2), round(2, PHASE_4)]
    expect(projectReferenceRound(rounds)).toBeNull()
    expect(referenceRoundOf(rounds, { roundNumber: 3 })).toBeNull()
    expect(projectReferenceRound([])).toBeNull()
    expect(referenceRoundOf([], { roundNumber: 1 })).toBeNull()
  })

  it('respeita as passagens anteriores pela Fase 4', () => {
    const rounds = [
      round(1, PHASE_2),
      round(2, PHASE_3),
      round(3, PHASE_4),
      round(4, PHASE_3),
      round(5, PHASE_4),
    ]
    expect(numberOf(referenceRoundOf(rounds, { roundNumber: 3 }))).toBe(2)
    expect(numberOf(referenceRoundOf(rounds, { roundNumber: 5 }))).toBe(4)
    expect(numberOf(projectReferenceRound(rounds))).toBe(4)
  })

  it('não depende da ordem de entrada', () => {
    const rounds = [
      round(4, PHASE_3),
      round(1, PHASE_2),
      round(5, PHASE_4),
      round(2, PHASE_3),
      round(3, PHASE_4),
    ]
    expect(numberOf(referenceRoundOf(rounds, { roundNumber: 3 }))).toBe(2)
    expect(numberOf(referenceRoundOf(rounds, { roundNumber: 5 }))).toBe(4)
    expect(numberOf(projectReferenceRound(rounds))).toBe(4)
  })
})

describe('app/projects/[id]/rounds/reference-round — versionChanges', () => {
  it('é vazia quando as versões são iguais', () => {
    expect(versionChanges({ codebook: 2, prompt: 3 }, { codebook: 2, prompt: 3 })).toEqual([])
  })

  it('aponta só o codebook ou só o prompt', () => {
    expect(versionChanges({ codebook: 1, prompt: 1 }, { codebook: 2, prompt: 1 })).toEqual([
      { subject: 'codebook', reference: 1, current: 2 },
    ])
    expect(versionChanges({ codebook: 1, prompt: 1 }, { codebook: 1, prompt: 2 })).toEqual([
      { subject: 'prompt', reference: 1, current: 2 },
    ])
  })

  it('aponta os dois, com o codebook primeiro', () => {
    expect(versionChanges({ codebook: 1, prompt: 2 }, { codebook: 3, prompt: 4 })).toEqual([
      { subject: 'codebook', reference: 1, current: 3 },
      { subject: 'prompt', reference: 2, current: 4 },
    ])
  })
})

describe('app/projects/[id]/rounds/reference-round — referenceVersionsOf', () => {
  const rounds = [round(1, PHASE_2), round(2, PHASE_3), round(3, PHASE_3, ROUND_OPEN)]

  it('é nula sem rodada de referência', () => {
    expect(referenceVersionsOf([round(1, PHASE_2)], { codebook: 1, prompt: 1 })).toBeNull()
  })

  it('é nula sem codebook ou prompt vigente', () => {
    expect(referenceVersionsOf(rounds, { codebook: null, prompt: 1 })).toBeNull()
    expect(referenceVersionsOf(rounds, { codebook: 1, prompt: null })).toBeNull()
  })

  it('traz a rodada, as versões dela e as vigentes', () => {
    expect(referenceVersionsOf(rounds, { codebook: 5, prompt: 6 })).toEqual({
      referenceRound: 2,
      reference: { codebook: 2, prompt: 12 },
      current: { codebook: 5, prompt: 6 },
    })
  })
})

describe('app/projects/[id]/rounds/reference-round — versionChangesSentence', () => {
  it('nomeia o codebook, os dois números e a rodada', () => {
    const sentence = versionChangesSentence(4, [
      { subject: 'codebook', reference: 1, current: 2 },
    ])
    expect(sentence).toBe(
      'O codebook mudou depois da rodada de referência: a rodada 4, a última fechada da ' +
        'Fase 3, usou a versão 1, e a vigente é a 2.',
    )
  })

  it('nomeia o prompt, os dois números e a rodada', () => {
    const sentence = versionChangesSentence(2, [{ subject: 'prompt', reference: 3, current: 5 }])
    expect(sentence).toBe(
      'O prompt mudou depois da rodada de referência: a rodada 2, a última fechada da ' +
        'Fase 3, usou a versão 3, e a vigente é a 5.',
    )
  })

  it('nomeia os dois, com as quatro versões e a rodada', () => {
    const sentence = versionChangesSentence(6, [
      { subject: 'codebook', reference: 1, current: 2 },
      { subject: 'prompt', reference: 3, current: 4 },
    ])
    expect(sentence).toBe(
      'O codebook e o prompt mudaram depois da rodada de referência: a rodada 6, a última ' +
        'fechada da Fase 3, usou o codebook na versão 1 e o prompt na versão 3, e os ' +
        'vigentes são o codebook na versão 2 e o prompt na versão 4.',
    )
  })
})
