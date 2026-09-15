import { orderKey } from './shuffle'

export type QueuedResponse = { id: string; label: string; evaluated: boolean }

export function responseLabel(position: number): string {
  return `Resposta ${position + 1}`
}

export function buildQueue(
  responses: readonly { id: string }[],
  evaluated: readonly string[],
  memberId: string,
  roundId: string,
): QueuedResponse[] {
  const done = new Set(evaluated)

  return responses
    .map((response, position) => ({
      id: response.id,
      label: responseLabel(position),
      evaluated: done.has(response.id),
      position,
      key: orderKey(memberId, roundId, response.id),
    }))
    .sort((a, b) => a.key - b.key || a.position - b.position)
    .map(({ id, label, evaluated }) => ({ id, label, evaluated }))
}

export function pickResponseId(
  queue: readonly QueuedResponse[],
  requested: string | null = null,
): string | null {
  if (queue.length === 0) return null

  if (requested && queue.some((response) => response.id === requested)) {
    return requested
  }

  const pending = queue.find((response) => !response.evaluated)

  return (pending ?? queue[0]).id
}

export function neighbours(
  queue: readonly QueuedResponse[],
  currentId: string,
): { prev: string | null; next: string | null } {
  const index = queue.findIndex((response) => response.id === currentId)
  if (index === -1) return { prev: null, next: null }

  return {
    prev: queue[index - 1]?.id ?? null,
    next: queue[index + 1]?.id ?? null,
  }
}

export function nextPendingId(
  queue: readonly QueuedResponse[],
  currentId: string,
): string | null {
  const start = queue.findIndex((response) => response.id === currentId)

  for (let step = 1; step <= queue.length; step += 1) {
    const candidate = queue[(start + step) % queue.length]
    if (candidate.id !== currentId && !candidate.evaluated) return candidate.id
  }

  return null
}
