export type PipelineInputKey = 'definition' | 'prompt' | 'item'

export type PipelineInputs = {
  definitions: number
  promptText: string | null
  items: number
}

export type PipelineRoute = 'codebook' | 'prompt' | 'items'

export type PipelineRequirement = {
  key: PipelineInputKey
  title: string
  pending: string
  route: PipelineRoute
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
    route: 'codebook',
  },
  {
    key: 'prompt',
    title: 'Texto do prompt',
    pending: 'Escreva o texto do prompt que será enviado à LLM.',
    route: 'prompt',
  },
  {
    key: 'item',
    title: 'Item de entrada',
    pending: 'Cadastre ao menos um item de entrada no pool do projeto.',
    route: 'items',
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
export const PHASE_3 = 3

export function missingInputsList(pending: readonly PipelineRequirement[]): string {
  const names = pending.map((req) => req.title.toLocaleLowerCase('pt-BR'))
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

export function missingInputsMessage(pending: readonly PipelineRequirement[]): string {
  if (pending.length === 0) return ''

  return (
    `Não foi possível avançar para a Fase 2. Ainda falta: ${missingInputsList(pending)}. ` +
    'Cadastre o que falta na tela do artefato correspondente (Codebook, Prompt ou Itens) ' +
    'e tente de novo.'
  )
}

export type Phase2Inputs = {
  openRoundNumber: number | null
  closedRounds: number
}

export type Phase2Blocker =
  | { key: 'open_round'; roundNumber: number }
  | { key: 'no_closed_round' }

export function phase2Blockers(inputs: Phase2Inputs): Phase2Blocker[] {
  const blockers: Phase2Blocker[] = []

  if (inputs.openRoundNumber !== null) {
    blockers.push({ key: 'open_round', roundNumber: inputs.openRoundNumber })
  }

  if (inputs.closedRounds < 1) blockers.push({ key: 'no_closed_round' })

  return blockers
}

export function canAdvanceFromPhase2(inputs: Phase2Inputs): boolean {
  return phase2Blockers(inputs).length === 0
}

export function phase2BlockerMessage(blocker: Phase2Blocker): string {
  switch (blocker.key) {
    case 'open_round':
      return (
        `A rodada ${blocker.roundNumber} ainda está aberta, e avançar para a Fase ` +
        `${PHASE_3} deixaria para trás um ciclo que nunca se fecha. Feche a rodada ` +
        `${blocker.roundNumber} e avance de novo.`
      )
    case 'no_closed_round':
      return (
        'Nenhuma rodada foi fechada nesta fase, e sem isso a Fase ' +
        `${PHASE_3} começaria de um codebook que ninguém aplicou do começo ao fim. ` +
        'Feche ao menos uma rodada antes de avançar.'
      )
  }
}

export function phase2BlockedMessage(blockers: readonly Phase2Blocker[]): string {
  const [first] = blockers
  if (!first) return ''

  const both = blockers.length > 1
  return (
    `Não foi possível avançar para a Fase ${PHASE_3}. ${phase2BlockerMessage(first)}` +
    (both
      ? ' Como nenhuma rodada foi fechada ainda, fechar a rodada aberta resolve as duas pendências de uma vez.'
      : '')
  )
}

export function wrongPhaseMessage(phase: number): string {
  return (
    `Este projeto está na Fase ${phase}, então não há o que avançar aqui. ` +
    'Recarregue a página para ver a fase atual.'
  )
}

export function phase3ConfirmationLines(): string[] {
  return [
    `Na Fase ${PHASE_3}, o codebook completo — com descrições e critérios — passa a ir à LLM junto com o prompt, e por isso as respostas mudam. A Fase ${PHASE_2} continua visível como está: rodadas, avaliações, concordância e anotações ficam onde estão.`,
    'A decisão de avançar é do Administrador. Nenhum valor de concordância libera nem impede o avanço: a faixa de referência ao lado é leitura, não regra.',
    `Não existe voltar da Fase ${PHASE_3} para a Fase ${PHASE_2}. O único retorno previsto no processo é o da Fase 4 para a Fase ${PHASE_3}.`,
    'Cancelar não muda nada.',
  ]
}
