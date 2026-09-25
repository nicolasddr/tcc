import { describe, it, expect } from 'vitest'
import {
  previousRoundOf,
  roundChanges,
  type RoundVersions,
} from '@/app/projects/[id]/(tabs)/rounds/round-changes'
import type { RoundSummary } from '@/app/projects/[id]/(tabs)/rounds/rounds'

function versions(
  roundNumber: number,
  phase: number,
  codebookVersionNumber: number,
  promptVersionNumber: number,
): RoundVersions {
  return { roundNumber, phase, codebookVersionNumber, promptVersionNumber }
}

function summary(
  roundNumber: number,
  phase: number,
  codebookVersionNumber = 1,
  promptVersionNumber = 1,
): RoundSummary {
  return {
    id: `r${roundNumber}`,
    roundNumber,
    status: 'closed',
    phase,
    createdAt: '2026-01-01T00:00:00.000Z',
    closedAt: '2026-01-02T00:00:00.000Z',
    authorName: 'Ana Pesquisadora',
    codebookVersionId: `cv${codebookVersionNumber}`,
    codebookVersionNumber,
    promptVersionNumber,
  }
}

describe('roundChanges — o que mudou em relação à rodada anterior', () => {
  it('só o codebook mudou', () => {
    const changes = roundChanges(versions(2, 2, 4, 1), versions(1, 2, 3, 1))

    expect(changes).not.toBeNull()
    expect(changes!.codebook).toEqual({ changed: true, from: 3, to: 4 })
    expect(changes!.prompt.changed).toBe(false)
    expect(changes!.phase.changed).toBe(false)
    expect(changes!.codebookAndPrompt).toBe(false)
    expect(changes!.entersPhase3).toBe(false)
  })

  it('só o prompt mudou', () => {
    const changes = roundChanges(versions(2, 2, 3, 2), versions(1, 2, 3, 1))

    expect(changes!.codebook.changed).toBe(false)
    expect(changes!.prompt).toEqual({ changed: true, from: 1, to: 2 })
    expect(changes!.phase.changed).toBe(false)
    expect(changes!.codebookAndPrompt).toBe(false)
    expect(changes!.entersPhase3).toBe(false)
  })

  it('codebook e prompt mudaram juntos', () => {
    const changes = roundChanges(versions(2, 2, 4, 2), versions(1, 2, 3, 1))

    expect(changes!.codebook.changed).toBe(true)
    expect(changes!.prompt.changed).toBe(true)
    expect(changes!.codebookAndPrompt).toBe(true)
    expect(changes!.entersPhase3).toBe(false)
  })

  it('nada mudou, e ainda assim a comparação existe', () => {
    const changes = roundChanges(versions(2, 2, 3, 1), versions(1, 2, 3, 1))

    expect(changes).toEqual({
      previousRoundNumber: 1,
      codebook: { changed: false, from: 3, to: 3 },
      prompt: { changed: false, from: 1, to: 1 },
      phase: { changed: false, from: 2, to: 2 },
      codebookAndPrompt: false,
      entersPhase3: false,
    })
  })

  it('a primeira rodada da Fase 3 com as mesmas versões muda só a fase', () => {
    const changes = roundChanges(versions(3, 3, 2, 2), versions(2, 2, 2, 2))

    expect(changes!.phase).toEqual({ changed: true, from: 2, to: 3 })
    expect(changes!.entersPhase3).toBe(true)
    expect(changes!.codebook.changed).toBe(false)
    expect(changes!.prompt.changed).toBe(false)
    expect(changes!.codebookAndPrompt).toBe(false)
  })

  it('a segunda rodada da Fase 3 não é mais a entrada na Fase 3', () => {
    const changes = roundChanges(versions(4, 3, 2, 2), versions(3, 3, 2, 2))

    expect(changes!.phase.changed).toBe(false)
    expect(changes!.entersPhase3).toBe(false)
  })

  it('o retorno da Fase 4 para a Fase 3 muda a fase sem ser a entrada na Fase 3', () => {
    const changes = roundChanges(versions(6, 3, 5, 3), versions(5, 4, 5, 3))

    expect(changes!.phase).toEqual({ changed: true, from: 4, to: 3 })
    expect(changes!.entersPhase3).toBe(false)
  })

  it('a primeira rodada do projeto não tem comparação', () => {
    expect(roundChanges(versions(1, 2, 1, 1), null)).toBeNull()
  })

  it('from e to carregam as versões das duas rodadas mesmo quando não mudaram', () => {
    const changes = roundChanges(versions(5, 3, 7, 4), versions(2, 3, 7, 4))

    expect(changes!.previousRoundNumber).toBe(2)
    expect(changes!.codebook).toEqual({ changed: false, from: 7, to: 7 })
    expect(changes!.prompt).toEqual({ changed: false, from: 4, to: 4 })
    expect(changes!.phase).toEqual({ changed: false, from: 3, to: 3 })
  })

  it('não recebe nem devolve ICR ou Qualidade, só versões', () => {
    const changes = roundChanges(versions(2, 2, 2, 2), versions(1, 2, 1, 1))

    expect(Object.keys(changes!).sort()).toEqual([
      'codebook',
      'codebookAndPrompt',
      'entersPhase3',
      'phase',
      'previousRoundNumber',
      'prompt',
    ])
  })
})

describe('previousRoundOf — a rodada imediatamente anterior do projeto', () => {
  it('acha a de número imediatamente menor, atravessando fases', () => {
    const rounds = [summary(1, 2), summary(2, 2), summary(3, 3), summary(4, 3)]

    expect(previousRoundOf(rounds, rounds[2])).toBe(rounds[1])
    expect(previousRoundOf(rounds, rounds[3])).toBe(rounds[2])
  })

  it('a primeira rodada não tem anterior', () => {
    const rounds = [summary(1, 2), summary(2, 2)]

    expect(previousRoundOf(rounds, rounds[0])).toBeNull()
    expect(previousRoundOf([], summary(1, 2))).toBeNull()
  })

  it('não depende da ordem do array', () => {
    const rounds = [summary(3, 3), summary(1, 2), summary(4, 3), summary(2, 2)]

    expect(previousRoundOf(rounds, rounds[2])!.roundNumber).toBe(3)
    expect(previousRoundOf(rounds, rounds[0])!.roundNumber).toBe(2)
    expect(previousRoundOf(rounds, rounds[3])!.roundNumber).toBe(1)
  })

  it('funciona com números não contíguos', () => {
    const rounds = [summary(1, 2), summary(2, 2), summary(5, 3)]

    expect(previousRoundOf(rounds, rounds[2])!.roundNumber).toBe(2)
  })

  it('a rodada que ainda não está na lista também acha a anterior', () => {
    const rounds = [summary(1, 2), summary(2, 2)]

    expect(previousRoundOf(rounds, versions(3, 3, 1, 1))).toBe(rounds[1])
  })

  it('RoundSummary entra direto em roundChanges', () => {
    const rounds = [summary(1, 2, 1, 1), summary(2, 2, 2, 2)]

    const changes = roundChanges(rounds[1], previousRoundOf(rounds, rounds[1]))

    expect(changes!.previousRoundNumber).toBe(1)
    expect(changes!.codebookAndPrompt).toBe(true)
  })
})
