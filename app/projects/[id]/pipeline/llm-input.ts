import { generalCriteria, ownCriteria } from './criteria'
import { PHASE_3 } from './preconditions'

export const DEFINITIONS_HEADING = 'Definições:'

export const ITEM_HEADING = 'Item de entrada:'

export const CODEBOOK_HEADING = 'Codebook:'

export const DEFINITION_PREFIX = 'Definição: '

export const OWN_CRITERIA_HEADING = 'Critérios:'

export const GENERAL_CRITERIA_HEADING = 'Critérios gerais, que valem para todas as definições:'

export type LlmDefinition = { id: string; title: string; description: string | null }

export type LlmCriterion = {
  definitionId: string | null
  name: string
  description: string | null
}

export type LlmInputParts = {
  phase: number
  promptText: string
  definitions: readonly LlmDefinition[]
  criteria: readonly LlmCriterion[]
  itemContent: string
}

function titlesBlock(definitions: readonly LlmDefinition[]): string {
  const titles = definitions.map((definition) => `- ${definition.title}`).join('\n')
  return `${DEFINITIONS_HEADING}\n${titles}`
}

function criterionLine(criterion: LlmCriterion): string {
  return criterion.description === null
    ? `- ${criterion.name}`
    : `- ${criterion.name}: ${criterion.description}`
}

function definitionParagraph(
  definition: LlmDefinition,
  criteria: readonly LlmCriterion[],
): string {
  const lines = [`${DEFINITION_PREFIX}${definition.title}`]
  if (definition.description !== null) lines.push(definition.description)

  const own = ownCriteria(definition.id, criteria)
  if (own.length > 0) lines.push(OWN_CRITERIA_HEADING, ...own.map(criterionLine))

  return lines.join('\n')
}

function codebookBlock(
  definitions: readonly LlmDefinition[],
  criteria: readonly LlmCriterion[],
): string {
  const paragraphs = [
    CODEBOOK_HEADING,
    ...definitions.map((definition) => definitionParagraph(definition, criteria)),
  ]

  const general = generalCriteria(criteria)
  if (general.length > 0) {
    paragraphs.push([GENERAL_CRITERIA_HEADING, ...general.map(criterionLine)].join('\n'))
  }

  return paragraphs.join('\n\n')
}

export function composeLlmInput({
  phase,
  promptText,
  definitions,
  criteria,
  itemContent,
}: LlmInputParts): string {
  const codebook =
    phase >= PHASE_3 ? codebookBlock(definitions, criteria) : titlesBlock(definitions)

  return [promptText, codebook, `${ITEM_HEADING}\n${itemContent}`].join('\n\n')
}
