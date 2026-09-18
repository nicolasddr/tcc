import { ordinalAlpha, type Agreement } from '@/lib/agreement'
import type { RoundObservation } from './agreement'
import type { RoundSummary } from './rounds'

export type SeriesPoint = {
  roundId: string
  roundNumber: number
  codebookVersionNumber: number
  closedAt: string | null
  agreement: Agreement
  hasOutlier: boolean
}

export function agreementSeries(
  rounds: readonly RoundSummary[],
  observations: ReadonlyMap<string, RoundObservation[]>,
  outliers: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): SeriesPoint[] {
  return rounds.map((round) => ({
    roundId: round.id,
    roundNumber: round.roundNumber,
    codebookVersionNumber: round.codebookVersionNumber,
    closedAt: round.closedAt,
    agreement: ordinalAlpha(observations.get(round.id) ?? []),
    hasOutlier: (outliers.get(round.id)?.size ?? 0) > 0,
  }))
}
