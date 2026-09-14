export function pickResponseId(
  responses: readonly { id: string }[],
  evaluated: readonly string[],
  requested: string | null = null,
): string | null {
  if (responses.length === 0) return null

  if (requested && responses.some((response) => response.id === requested)) {
    return requested
  }

  const done = new Set(evaluated)
  const pending = responses.find((response) => !done.has(response.id))

  return (pending ?? responses[0]).id
}

export function nextResponseId(
  responses: readonly { id: string }[],
  evaluated: readonly string[],
  currentId: string,
): string | null {
  const done = new Set(evaluated)
  const next = responses.find(
    (response) => response.id !== currentId && !done.has(response.id),
  )

  return next?.id ?? null
}
