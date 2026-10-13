type SaveState = { error: string } | { ok: true; nonce: number } | null

export function savedNonceOf(state: SaveState): number {
  return state !== null && 'ok' in state ? state.nonce : 0
}

export function isEditing(state: SaveState, editingNonce: number | null): boolean {
  if (editingNonce === null) return false
  return (state !== null && 'error' in state) || editingNonce === savedNonceOf(state)
}
