import { ordinalAlpha, type Agreement } from '@/lib/agreement'
import type { RoundObservation } from './agreement'
import type { RoundSummary } from './rounds'

export type SeriesPoint = {
  roundId: string
  roundNumber: number
  phase: number
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
    phase: round.phase,
    codebookVersionNumber: round.codebookVersionNumber,
    closedAt: round.closedAt,
    agreement: ordinalAlpha(observations.get(round.id) ?? []),
    hasOutlier: (outliers.get(round.id)?.size ?? 0) > 0,
  }))
}

export type PhaseRun<T extends { phase: number } = SeriesPoint> = {
  phase: number
  points: T[]
}

export function phaseRuns<T extends { phase: number }>(points: readonly T[]): PhaseRun<T>[] {
  const runs: PhaseRun<T>[] = []
  for (const point of points) {
    const last = runs.at(-1)
    if (last && last.phase === point.phase) {
      last.points.push(point)
    } else {
      runs.push({ phase: point.phase, points: [point] })
    }
  }
  return runs
}
