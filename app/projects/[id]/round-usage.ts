export type RoundTag = { roundNumber: number; phase: number }

function joinList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}

export function roundsLabel(rounds: readonly RoundTag[]): string | null {
  if (rounds.length === 0) return null

  const groups: { phase: number; numbers: number[] }[] = []
  for (const { roundNumber, phase } of rounds) {
    const last = groups[groups.length - 1]
    if (last && last.phase === phase) last.numbers.push(roundNumber)
    else groups.push({ phase, numbers: [roundNumber] })
  }

  const list = joinList(
    groups.map(
      (group) => `${joinList(group.numbers.map(String))} (Fase ${group.phase})`,
    ),
  )
  return rounds.length === 1 ? `na rodada ${list}` : `nas rodadas ${list}`
}

export function itemUsageLabel(rounds: readonly RoundTag[]): string | null {
  const label = roundsLabel(rounds)
  return label && `usado ${label}`
}

export function participationLabel(rounds: readonly RoundTag[]): string | null {
  const label = roundsLabel(rounds)
  return label && `avaliou ${label}`
}
