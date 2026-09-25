import { SCALE, scaleRank, type ScaleValue } from '../evaluate/scale'
import { PHASE_3 } from '../../pipeline/preconditions'
import type { RoundObservation } from './agreement'
import { withoutExcluded } from './agreement-pair'

export type QualityLevel = { value: ScaleValue; count: number; share: number }

export type Quality =
  | { rated: false; total: 0 }
  | { rated: true; total: number; levels: QualityLevel[] }

export type QualityPair = {
  all: Quality
  withoutOutliers: Quality | null
  excluded: number
}

export function hasQuality(phase: number): boolean {
  return phase >= PHASE_3
}

export function qualityOf(observations: readonly RoundObservation[]): Quality {
  const total = observations.length
  if (total === 0) return { rated: false, total: 0 }

  return {
    rated: true,
    total,
    levels: SCALE.map((value) => {
      const rank = scaleRank(value)
      const count = observations.filter((observation) => observation.value === rank).length
      return { value, count, share: count / total }
    }),
  }
}

export function qualityPair(
  observations: readonly RoundObservation[],
  excluded: ReadonlySet<string>,
): QualityPair {
  return {
    all: qualityOf(observations),
    withoutOutliers:
      excluded.size === 0 ? null : qualityOf(withoutExcluded(observations, excluded)),
    excluded: excluded.size,
  }
}
