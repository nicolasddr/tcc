export const ITEM_PREVIEW_MAX = 140

export function itemPreview(content: string, max: number = ITEM_PREVIEW_MAX): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max).trimEnd()}…`
}
