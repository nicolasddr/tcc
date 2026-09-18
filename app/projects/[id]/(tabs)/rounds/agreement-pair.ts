import { ordinalAlpha, type Agreement } from '@/lib/agreement'
import type { RoundObservation } from './agreement'

export type AgreementPair = {
  all: Agreement
  withoutOutliers: Agreement | null
  excluded: number
}

export function withoutExcluded(
  observations: readonly RoundObservation[],
  excluded: ReadonlySet<string>,
): RoundObservation[] {
  return observations.filter(
    (observation) => !excluded.has(observation.projectMemberId),
  )
}

export function agreementPair(
  observations: readonly RoundObservation[],
  excluded: ReadonlySet<string>,
): AgreementPair {
  return {
    all: ordinalAlpha(observations),
    withoutOutliers:
      excluded.size === 0
        ? null
        : ordinalAlpha(withoutExcluded(observations, excluded)),
    excluded: excluded.size,
  }
}

export function evaluatedResponses(
  observations: readonly RoundObservation[],
): number {
  return new Set(observations.map((observation) => observation.responseId)).size
}
