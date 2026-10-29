import type { RoundObservation } from './agreement'

export function withoutExcluded(
  observations: readonly RoundObservation[],
  excluded: ReadonlySet<string>,
): RoundObservation[] {
  return observations.filter(
    (observation) => !excluded.has(observation.projectMemberId),
  )
}

export function evaluatedResponses(
  observations: readonly RoundObservation[],
): number {
  return new Set(observations.map((observation) => observation.responseId)).size
}

export function evaluatedRaters(observations: readonly RoundObservation[]): number {
  return new Set(observations.map((observation) => observation.raterId)).size
}
