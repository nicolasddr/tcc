// Tipo de tarefa do projeto (HU-013, ADR 0005). Dica opcional declarada na
// criação; os valores em código casam com o CHECK da migration 0004, os rótulos
// são da UI (PT). Módulo neutro: usado pelo Server Action e pelo formulário client.

export const TASK_TYPE_OPTIONS = [
  { value: 'classification', label: 'Classificação' },
  { value: 'quality_evaluation', label: 'Avaliação de qualidade' },
  { value: 'generation', label: 'Geração' },
  { value: 'mixed', label: 'Não sei / Misto' },
  { value: 'other', label: 'Outro' },
] as const

export type TaskType = (typeof TASK_TYPE_OPTIONS)[number]['value']

const VALUES = TASK_TYPE_OPTIONS.map((o) => o.value) as readonly string[]

// Normaliza o valor vindo do formulário: um dos códigos válidos, ou null.
export function normalizeTaskType(raw: string | null | undefined): TaskType | null {
  return raw && VALUES.includes(raw) ? (raw as TaskType) : null
}

// Rótulo de exibição para um código salvo (null quando o projeto não declarou tipo).
export function taskTypeLabel(value: string | null | undefined): string | null {
  return TASK_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? null
}
