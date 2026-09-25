import type { RoundObservation } from './agreement'
import type { RoundSummary } from './rounds'
import { hasQuality, qualityPair, type QualityPair } from './quality'

export type QualitySeriesPoint = {
  roundId: string
  roundNumber: number
  codebookVersionNumber: number
  promptVersionNumber: number
  closedAt: string | null
  pair: QualityPair
}

export function qualitySeries(
  rounds: readonly RoundSummary[],
  observations: ReadonlyMap<string, RoundObservation[]>,
  outliers: ReadonlyMap<string, ReadonlySet<string>>,
): QualitySeriesPoint[] {
  return rounds
    .filter((round) => hasQuality(round.phase))
    .map((round) => ({
      roundId: round.id,
      roundNumber: round.roundNumber,
      codebookVersionNumber: round.codebookVersionNumber,
      promptVersionNumber: round.promptVersionNumber,
      closedAt: round.closedAt,
      pair: qualityPair(
        observations.get(round.id) ?? [],
        outliers.get(round.id) ?? new Set<string>(),
      ),
    }))
}
