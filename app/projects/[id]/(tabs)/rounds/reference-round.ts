import { PHASE_3 } from '../../pipeline/preconditions'
import { isOpen } from './round-status'

export type ReferenceCandidate = { roundNumber: number; phase: number; status: string }

export type VersionPair = { codebook: number; prompt: number }

export type VersionChange = {
  subject: 'codebook' | 'prompt'
  reference: number
  current: number
}

export type VersionCheck = { referenceRound: number; reference: VersionPair; current: VersionPair }

function latestClosedPhase3Round<T extends ReferenceCandidate>(
  rounds: readonly T[],
  before: number,
): T | null {
  let latest: T | null = null
  for (const round of rounds) {
    if (round.phase !== PHASE_3 || isOpen(round) || round.roundNumber >= before) continue
    if (latest === null || round.roundNumber > latest.roundNumber) latest = round
  }
  return latest
}

export function referenceRoundOf<T extends ReferenceCandidate>(
  rounds: readonly T[],
  round: { roundNumber: number },
): T | null {
  return latestClosedPhase3Round(rounds, round.roundNumber)
}

export function projectReferenceRound<T extends ReferenceCandidate>(rounds: readonly T[]): T | null {
  return latestClosedPhase3Round(rounds, Infinity)
}

export function versionChanges(reference: VersionPair, current: VersionPair): VersionChange[] {
  const changes: VersionChange[] = []
  for (const subject of ['codebook', 'prompt'] as const) {
    if (reference[subject] !== current[subject]) {
      changes.push({ subject, reference: reference[subject], current: current[subject] })
    }
  }
  return changes
}

export function referenceVersionsOf(
  rounds: readonly (ReferenceCandidate & {
    codebookVersionNumber: number
    promptVersionNumber: number
  })[],
  current: { codebook: number | null; prompt: number | null },
): VersionCheck | null {
  const reference = projectReferenceRound(rounds)
  if (reference === null || current.codebook === null || current.prompt === null) return null

  return {
    referenceRound: reference.roundNumber,
    reference: {
      codebook: reference.codebookVersionNumber,
      prompt: reference.promptVersionNumber,
    },
    current: { codebook: current.codebook, prompt: current.prompt },
  }
}

export function versionChangesSentence(
  referenceRound: number,
  changes: readonly VersionChange[],
): string {
  const where = `a rodada ${referenceRound}, a última fechada da Fase ${PHASE_3}`
  const codebook = changes.find((change) => change.subject === 'codebook')
  const prompt = changes.find((change) => change.subject === 'prompt')

  if (codebook && prompt) {
    return (
      `O codebook e o prompt mudaram depois da rodada de referência: ${where}, usou o ` +
      `codebook na versão ${codebook.reference} e o prompt na versão ${prompt.reference}, ` +
      `e os vigentes são o codebook na versão ${codebook.current} e o prompt na versão ` +
      `${prompt.current}.`
    )
  }

  const only = codebook ?? prompt
  if (!only) return ''

  return (
    `O ${only.subject} mudou depois da rodada de referência: ${where}, usou a versão ` +
    `${only.reference}, e a vigente é a ${only.current}.`
  )
}
