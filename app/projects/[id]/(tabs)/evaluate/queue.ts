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
