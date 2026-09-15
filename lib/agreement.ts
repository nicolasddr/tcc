export type Observation = {
  unitId: string
  raterId: string
  value: number
}

export type NotCalculableReason = 'few_evaluators' | 'no_shared_units' | 'no_variation'

export type Agreement =
  | { calculable: true; alpha: number; units: number; raters: number }
  | { calculable: false; reason: NotCalculableReason; units: number; raters: number }

function groupByUnit(observations: readonly Observation[]): number[][] {
  const units = new Map<string, number[]>()
  for (const observation of observations) {
    const values = units.get(observation.unitId)
    if (values) values.push(observation.value)
    else units.set(observation.unitId, [observation.value])
  }
  return [...units.values()]
}

function coincidences(pairable: readonly number[][]): Map<number, Map<number, number>> {
  const matrix = new Map<number, Map<number, number>>()
  const add = (c: number, k: number, weight: number) => {
    const row = matrix.get(c) ?? new Map<number, number>()
    row.set(k, (row.get(k) ?? 0) + weight)
    matrix.set(c, row)
  }
  for (const values of pairable) {
    const weight = 1 / (values.length - 1)
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < values.length; j++) {
        if (i !== j) add(values[i], values[j], weight)
      }
    }
  }
  return matrix
}

function marginals(matrix: Map<number, Map<number, number>>): Map<number, number> {
  const totals = new Map<number, number>()
  for (const [c, row] of matrix) {
    let total = 0
    for (const weight of row.values()) total += weight
    totals.set(c, total)
  }
  return totals
}

function ordinalDistances(totals: Map<number, number>): Map<number, Map<number, number>> {
  const ranks = [...totals.keys()].sort((a, b) => a - b)
  const cumulative: number[] = []
  let running = 0
  for (const rank of ranks) {
    running += totals.get(rank) ?? 0
    cumulative.push(running)
  }
  const distances = new Map<number, Map<number, number>>()
  for (let i = 0; i < ranks.length; i++) {
    const row = new Map<number, number>()
    for (let j = 0; j < ranks.length; j++) {
      const low = Math.min(i, j)
      const high = Math.max(i, j)
      const between = cumulative[high] - (low > 0 ? cumulative[low - 1] : 0)
      const ends = ((totals.get(ranks[i]) ?? 0) + (totals.get(ranks[j]) ?? 0)) / 2
      row.set(ranks[j], i === j ? 0 : (between - ends) ** 2)
    }
    distances.set(ranks[i], row)
  }
  return distances
}

export function ordinalAlpha(observations: readonly Observation[]): Agreement {
  const raters = new Set(observations.map((observation) => observation.raterId)).size
  const pairable = groupByUnit(observations).filter((values) => values.length >= 2)
  const units = pairable.length

  if (raters < 2) return { calculable: false, reason: 'few_evaluators', units, raters }
  if (units === 0) return { calculable: false, reason: 'no_shared_units', units, raters }

  const matrix = coincidences(pairable)
  const totals = marginals(matrix)
  const distances = ordinalDistances(totals)
  const ranks = [...totals.keys()]

  let n = 0
  for (const total of totals.values()) n += total

  let observed = 0
  let expected = 0
  for (const c of ranks) {
    for (const k of ranks) {
      const distance = distances.get(c)?.get(k) ?? 0
      observed += (matrix.get(c)?.get(k) ?? 0) * distance
      expected += (totals.get(c) ?? 0) * (totals.get(k) ?? 0) * distance
    }
  }

  if (expected === 0) return { calculable: false, reason: 'no_variation', units, raters }

  return { calculable: true, alpha: 1 - ((n - 1) * observed) / expected, units, raters }
}
