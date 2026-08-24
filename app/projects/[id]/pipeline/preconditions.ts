export type PipelineInputKey = 'definition' | 'prompt' | 'item'

export type PipelineInputs = {
  definitions: number
  promptText: string | null
  items: number
}

export type PipelineRequirement = {
  key: PipelineInputKey
  title: string
  pending: string
  anchor: string
}

export const EMPTY_PIPELINE: PipelineInputs = {
  definitions: 0,
  promptText: null,
  items: 0,
}

export const PIPELINE_REQUIREMENTS: readonly PipelineRequirement[] = [
  {
    key: 'definition',
    title: 'Definição',
    pending: 'Cadastre ao menos uma definição para estruturar a tarefa da LLM.',
    anchor: 'definicoes',
  },
  {
    key: 'prompt',
    title: 'Texto do prompt',
    pending: 'Escreva o texto do prompt que será enviado à LLM.',
    anchor: 'prompt',
  },
  {
    key: 'item',
    title: 'Item de entrada',
    pending: 'Cadastre ao menos um item de entrada no pool do projeto.',
    anchor: 'itens',
  },
] as const

function isSatisfied(key: PipelineInputKey, inputs: PipelineInputs): boolean {
  switch (key) {
    case 'definition':
      return inputs.definitions > 0
    case 'prompt':
      return (inputs.promptText ?? '').trim().length > 0
    case 'item':
      return inputs.items > 0
  }
}

export function pendingRequirements(inputs: PipelineInputs): PipelineRequirement[] {
  return PIPELINE_REQUIREMENTS.filter((req) => !isSatisfied(req.key, inputs))
}

export function canAdvanceFromPhase1(inputs: PipelineInputs): boolean {
  return pendingRequirements(inputs).length === 0
}
