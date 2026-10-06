import { PHASE_4 } from '../../pipeline/preconditions'
import { agreementPair, type AgreementPair } from './agreement-pair'
import type { QualityPair } from './quality'
import { referenceRoundOf } from './reference-round'
import type { RoundSummary } from './rounds'

export type ComparedRound = {
  id: string
  roundNumber: number
  phase: number
  status: string
  closedAt: string | null
  codebookVersionNumber: number
  promptVersionNumber: number
  agreement: AgreementPair
  quality: QualityPair | null
}

export type ReferenceComparison =
  | { kind: 'not_phase_4' }
  | { kind: 'no_reference' }
  | { kind: 'compared'; round: ComparedRound; reference: ComparedRound }

const NO_AGREEMENT = agreementPair([], new Set())

function comparedRound(
  round: RoundSummary,
  agreement: ReadonlyMap<string, AgreementPair>,
  quality: ReadonlyMap<string, QualityPair>,
): ComparedRound {
  return {
    id: round.id,
    roundNumber: round.roundNumber,
    phase: round.phase,
    status: round.status,
    closedAt: round.closedAt,
    codebookVersionNumber: round.codebookVersionNumber,
    promptVersionNumber: round.promptVersionNumber,
    agreement: agreement.get(round.id) ?? NO_AGREEMENT,
    quality: quality.get(round.id) ?? null,
  }
}

export function referenceComparison(
  rounds: readonly RoundSummary[],
  round: RoundSummary,
  agreement: ReadonlyMap<string, AgreementPair>,
  quality: ReadonlyMap<string, QualityPair>,
): ReferenceComparison {
  if (round.phase !== PHASE_4) return { kind: 'not_phase_4' }

  const reference = referenceRoundOf(rounds, round)
  if (reference === null) return { kind: 'no_reference' }

  return {
    kind: 'compared',
    round: comparedRound(round, agreement, quality),
    reference: comparedRound(reference, agreement, quality),
  }
}
