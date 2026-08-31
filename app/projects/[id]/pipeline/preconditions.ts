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

export const PHASE_1 = 1
export const PHASE_2 = 2

export function missingInputsList(pending: readonly PipelineRequirement[]): string {
  const names = pending.map((req) => req.title.toLocaleLowerCase('pt-BR'))
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

export function missingInputsMessage(pending: readonly PipelineRequirement[]): string {
  if (pending.length === 0) return ''

  return (
    `Não foi possível avançar para a Fase 2. Ainda falta: ${missingInputsList(pending)}. ` +
    'Cadastre o que falta na configuração da Fase 1 e tente de novo.'
  )
}
