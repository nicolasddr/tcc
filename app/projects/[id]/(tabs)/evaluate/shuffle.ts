const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

function avalanche(value: number): number {
  let mixed = value
  mixed ^= mixed >>> 16
  mixed = Math.imul(mixed, 0x85ebca6b)
  mixed ^= mixed >>> 13
  mixed = Math.imul(mixed, 0xc2b2ae35)
  mixed ^= mixed >>> 16
  return mixed >>> 0
}

export function hash32(text: string): number {
  let hash = FNV_OFFSET

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME)
  }

  return avalanche(hash)
}

export function orderKey(
  memberId: string,
  roundId: string,
  responseId: string,
): number {
  return hash32(`${memberId}:${roundId}:${responseId}`)
}
