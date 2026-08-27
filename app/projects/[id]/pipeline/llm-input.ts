export const DEFINITIONS_HEADING = 'Definições:'

export const ITEM_HEADING = 'Item de entrada:'

export type LlmInputParts = {
  promptText: string
  definitionTitles: string[]
  itemContent: string
}

export function composeLlmInput({
  promptText,
  definitionTitles,
  itemContent,
}: LlmInputParts): string {
  const definitions = definitionTitles.map((title) => `- ${title}`).join('\n')
  return [
    promptText,
    `${DEFINITIONS_HEADING}\n${definitions}`,
    `${ITEM_HEADING}\n${itemContent}`,
  ].join('\n\n')
}
