export const ITEM_PREVIEW_MAX = 140

export const ITEM_PREVIEW_LINES = 3

export function itemPreview(content: string, max: number = ITEM_PREVIEW_MAX): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max).trimEnd()}…`
}

export function itemPreviewLines(
  content: string,
  maxLines: number = ITEM_PREVIEW_LINES,
  maxChars: number = ITEM_PREVIEW_MAX,
): string {
  const lines = content
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter((line) => line.length > 0)

  const text = lines.slice(0, maxLines).join('\n')

  if (text.length > maxChars) return `${text.slice(0, maxChars).trimEnd()}…`
  if (lines.length > maxLines) return `${text}…`
  return text
}
