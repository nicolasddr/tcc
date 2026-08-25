export const DEFINITION_TYPE_OPTIONS = [
  {
    value: 'category',
    label: 'Categoria',
    hint: 'Rótulo nominal para tarefa de classificação, como “Informacional” ou “Transacional”.',
  },
  {
    value: 'quality_dimension',
    label: 'Dimensão de qualidade',
    hint: 'Aspecto a avaliar em texto livre, como “Atomicidade” ou “Clareza”.',
  },
  {
    value: 'guideline',
    label: 'Diretriz',
    hint: 'Característica que o conteúdo gerado deve ter, em tarefa de geração.',
  },
] as const

export type DefinitionType = (typeof DEFINITION_TYPE_OPTIONS)[number]['value']

const VALUES = DEFINITION_TYPE_OPTIONS.map((o) => o.value) as readonly string[]

const BY_TASK_TYPE: Record<string, DefinitionType> = {
  classification: 'category',
  quality_evaluation: 'quality_dimension',
  generation: 'guideline',
}

export function normalizeDefinitionType(
  raw: string | null | undefined,
): DefinitionType | null {
  return raw && VALUES.includes(raw) ? (raw as DefinitionType) : null
}

export function definitionTypeLabel(value: string | null | undefined): string | null {
  return DEFINITION_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? null
}

export function defaultDefinitionType(
  taskType: string | null | undefined,
): DefinitionType | null {
  return taskType ? (BY_TASK_TYPE[taskType] ?? null) : null
}
