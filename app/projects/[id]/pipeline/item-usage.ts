export function itemUsageLabel(roundNumbers: readonly number[]): string | null {
  if (roundNumbers.length === 0) return null
  return roundNumbers.length === 1
    ? `usado na rodada ${roundNumbers[0]}`
    : `usado nas rodadas ${roundNumbers.join(', ')}`
}
