import { PHASE_3 } from '../../pipeline/preconditions'

export type RoundVersions = {
  roundNumber: number
  phase: number
  codebookVersionNumber: number
  promptVersionNumber: number
}

export type Change = { changed: boolean; from: number; to: number }

export type RoundChanges = {
  previousRoundNumber: number
  codebook: Change
  prompt: Change
  phase: Change
  codebookAndPrompt: boolean
  entersPhase3: boolean
}

export function previousRoundOf<R extends RoundVersions>(
  rounds: readonly R[],
  round: RoundVersions,
): R | null {
  let previous: R | null = null
  for (const candidate of rounds) {
    if (candidate.roundNumber >= round.roundNumber) continue
    if (previous === null || candidate.roundNumber > previous.roundNumber) {
      previous = candidate
    }
  }
  return previous
}

function change(from: number, to: number): Change {
  return { changed: from !== to, from, to }
}

export function roundChanges(
  round: RoundVersions,
  previous: RoundVersions | null,
): RoundChanges | null {
  if (previous === null) return null

  const codebook = change(previous.codebookVersionNumber, round.codebookVersionNumber)
  const prompt = change(previous.promptVersionNumber, round.promptVersionNumber)

  return {
    previousRoundNumber: previous.roundNumber,
    codebook,
    prompt,
    phase: change(previous.phase, round.phase),
    codebookAndPrompt: codebook.changed && prompt.changed,
    entersPhase3: previous.phase < PHASE_3 && round.phase >= PHASE_3,
  }
}
