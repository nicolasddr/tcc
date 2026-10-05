export const ROUND_OPEN = 'open'
export const ROUND_CLOSED = 'closed'

export function isOpen(round: { status: string }): boolean {
  return round.status === ROUND_OPEN
}
