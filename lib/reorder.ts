export function moveBy<T>(list: readonly T[], index: number, offset: number): T[] {
  const next = [...list]
  const target = index + offset
  if (index < 0 || index >= next.length) return next
  if (target < 0 || target >= next.length) return next
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}
