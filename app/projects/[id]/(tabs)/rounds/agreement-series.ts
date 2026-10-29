import type { CodebookCriterion, RoundCodebook } from '../../pipeline/codebook'
import type { RoundObservation } from './agreement'
import {
  columnIdentity,
  criterionCells,
  type MatrixCell,
  type MatrixColumn,
} from './agreement-matrix'
import type { RoundSummary } from './rounds'

export type SeriesRound = {
  roundId: string
  roundNumber: number
  phase: number
  codebookVersionNumber: number
  closedAt: string | null
  hasOutlier: boolean
}

export type SeriesPoint = SeriesRound & { cell: MatrixCell | null }

export type CriterionSeries = {
  key: string
  column: MatrixColumn<CodebookCriterion>
  points: SeriesPoint[]
}

export type AgreementSeries = {
  rounds: SeriesRound[]
  criteria: CriterionSeries[]
}

export function agreementSeries(
  rounds: readonly RoundSummary[],
  codebooks: ReadonlyMap<string, RoundCodebook>,
  observations: ReadonlyMap<string, readonly RoundObservation[]>,
  outliers: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): AgreementSeries {
  const seriesRounds = rounds.map((round) => ({
    roundId: round.id,
    roundNumber: round.roundNumber,
    phase: round.phase,
    codebookVersionNumber: round.codebookVersionNumber,
    closedAt: round.closedAt,
    hasOutlier: (outliers.get(round.id)?.size ?? 0) > 0,
  }))

  const columns = new Map<string, MatrixColumn<CodebookCriterion>>()
  const cells = rounds.map((round) => {
    const codebook = codebooks.get(round.codebookVersionId)
    const byKey = new Map<string, MatrixCell>()
    for (const { column, cell } of criterionCells(
      codebook?.definitions ?? [],
      codebook?.criteria ?? [],
      observations.get(round.id) ?? [],
    )) {
      const key = columnIdentity(column)
      if (!columns.has(key)) columns.set(key, column)
      byKey.set(key, cell)
    }
    return byKey
  })

  return {
    rounds: seriesRounds,
    criteria: [...columns].map(([key, column]) => ({
      key,
      column,
      points: seriesRounds.map((round, index) => ({
        ...round,
        cell: cells[index].get(key) ?? null,
      })),
    })),
  }
}

export type PhaseRun<T extends { phase: number } = SeriesRound> = {
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
