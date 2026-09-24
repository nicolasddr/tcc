import type { LlmFailure } from '@/lib/ai/failure'
import { RESPONSE_TEXT_MAX } from '@/lib/limits'
import {
  definitionsWithoutCriteria,
  isCodebookComplete,
  quotedList,
  type CriterionScope,
  type DefinitionKey,
} from '../../pipeline/criteria'
import { PHASE_2, PHASE_3 } from '../../pipeline/preconditions'

export type RoundDefinition = DefinitionKey & { title: string }

export type RoundInputs = {
  phase: number
  definitions: readonly RoundDefinition[]
  criteria: readonly CriterionScope[]
  hasPromptVersion: boolean
  openRoundNumber: number | null
}

export type RoundBlocker =
  | { key: 'phase'; phase: number }
  | { key: 'open_round'; roundNumber: number }
  | { key: 'definition' }
  | { key: 'criteria'; titles: string[] }
  | { key: 'prompt' }

export function roundBlockers(inputs: RoundInputs): RoundBlocker[] {
  const blockers: RoundBlocker[] = []

  if (inputs.phase < PHASE_2) blockers.push({ key: 'phase', phase: inputs.phase })

  if (inputs.openRoundNumber !== null) {
    blockers.push({ key: 'open_round', roundNumber: inputs.openRoundNumber })
  }

  if (!isCodebookComplete(inputs.definitions, inputs.criteria)) {
    if (inputs.definitions.length === 0) {
      blockers.push({ key: 'definition' })
    } else {
      const uncovered = definitionsWithoutCriteria(inputs.definitions, inputs.criteria)
      blockers.push({ key: 'criteria', titles: uncovered.map((d) => d.title) })
    }
  }

  if (!inputs.hasPromptVersion) blockers.push({ key: 'prompt' })

  return blockers
}

export function canOpenRound(inputs: RoundInputs): boolean {
  return roundBlockers(inputs).length === 0
}

export function roundBlockerSummary(blocker: RoundBlocker): string {
  switch (blocker.key) {
    case 'phase':
      return `As rodadas começam na Fase ${PHASE_2}, e o projeto está na Fase ${blocker.phase}.`
    case 'open_round':
      return `A rodada ${blocker.roundNumber} ainda está aberta.`
    case 'definition':
      return 'O codebook ainda não tem nenhuma definição.'
    case 'criteria':
      return blocker.titles.length === 1
        ? `A definição ${quotedList(blocker.titles)} está sem nenhum critério.`
        : `${blocker.titles.length} definições estão sem nenhum critério.`
    case 'prompt':
      return 'Não há versão de prompt para esta rodada congelar.'
  }
}

export function roundBlockerMessage(blocker: RoundBlocker): string {
  switch (blocker.key) {
    case 'phase':
      return (
        `As rodadas começam na Fase ${PHASE_2}, e este projeto ainda está na Fase ` +
        `${blocker.phase}. Avance a fase para poder abrir a primeira rodada.`
      )
    case 'open_round':
      return (
        `A rodada ${blocker.roundNumber} ainda está aberta, e só existe uma rodada ` +
        'aberta por projeto. Feche-a para abrir a próxima.'
      )
    case 'definition':
      return (
        'O codebook ainda não tem nenhuma definição, então não haveria o que avaliar ' +
        'na rodada. Crie ao menos uma definição, com ao menos um critério, antes de ' +
        'abrir a rodada.'
      )
    case 'criteria': {
      const list = quotedList(blocker.titles)
      return blocker.titles.length === 1
        ? `A definição ${list} está sem nenhum critério, e o avaliador não teria régua nenhuma para julgá-la. Crie um critério nela, ou um critério geral que valha para todas as definições, antes de abrir a rodada.`
        : `As definições ${list} estão sem nenhum critério, e o avaliador não teria régua nenhuma para julgá-las. Crie um critério em cada uma, ou um critério geral que valha para todas as definições, antes de abrir a rodada.`
    }
    case 'prompt':
      return (
        'Não há versão de prompt para esta rodada congelar. Escreva o texto do prompt ' +
        'antes de abrir a rodada.'
      )
  }
}

export const SELECTION_MAX = 5

export type SelectionInputs = {
  available: readonly string[]
  usedInRound: readonly string[]
  max?: number
  responsesLeft?: number
}

export type SelectionBlocker =
  | { key: 'empty' }
  | { key: 'too_many'; count: number; max: number }
  | { key: 'ceiling'; count: number; left: number }
  | { key: 'repeated' }
  | { key: 'foreign' }
  | { key: 'already_used'; count: number }

export function generationMax(responsesLeft: number): number {
  return Math.max(0, Math.min(SELECTION_MAX, responsesLeft))
}

export function selectionBlockers(
  selected: readonly string[],
  { available, usedInRound, max = SELECTION_MAX, responsesLeft }: SelectionInputs,
): SelectionBlocker[] {
  const blockers: SelectionBlocker[] = []

  if (selected.length === 0) blockers.push({ key: 'empty' })

  if (selected.length > max) {
    blockers.push({ key: 'too_many', count: selected.length, max })
  }

  if (responsesLeft !== undefined && selected.length > responsesLeft) {
    blockers.push({ key: 'ceiling', count: selected.length, left: responsesLeft })
  }

  if (new Set(selected).size !== selected.length) blockers.push({ key: 'repeated' })

  const pool = new Set(available)
  if (selected.some((itemId) => !pool.has(itemId))) blockers.push({ key: 'foreign' })

  const used = new Set(usedInRound)
  const repeatedInRound = new Set(selected.filter((itemId) => used.has(itemId)))
  if (repeatedInRound.size > 0) {
    blockers.push({ key: 'already_used', count: repeatedInRound.size })
  }

  return blockers
}

export function canGenerate(
  selected: readonly string[],
  inputs: SelectionInputs,
): boolean {
  return selectionBlockers(selected, inputs).length === 0
}

export function selectionBlockerMessage(blocker: SelectionBlocker): string {
  switch (blocker.key) {
    case 'empty':
      return (
        'Nenhum item foi selecionado, e cada item selecionado é uma resposta a gerar. ' +
        `Escolha de 1 a ${SELECTION_MAX} itens.`
      )
    case 'too_many':
      return (
        `A geração aceita no máximo ${blocker.max} itens de cada vez, e vieram ` +
        `${blocker.count}. Tire alguns da seleção e gere de novo.`
      )
    case 'ceiling':
      return blocker.left === 0
        ? 'Este projeto não tem mais nenhuma vaga de resposta de LLM, e cada item selecionado gastaria uma. Fale com quem cuida da instalação para revisar o teto.'
        : `Restam ${blocker.left} ${blocker.left === 1 ? 'vaga' : 'vagas'} de resposta de LLM neste projeto, e vieram ${blocker.count} itens selecionados. Tire ${blocker.count - blocker.left} da seleção e gere de novo.`
    case 'repeated':
      return (
        'O mesmo item apareceu duas vezes na seleção, e um item produz exatamente uma ' +
        'resposta por rodada. Recarregue a página e selecione de novo.'
      )
    case 'foreign':
      return (
        'Algum item selecionado não é deste projeto. Recarregue a página para ver a ' +
        'lista atual de itens.'
      )
    case 'already_used':
      return blocker.count === 1
        ? 'Um dos itens selecionados já produziu resposta nesta rodada, e o mesmo item não gera duas respostas na mesma rodada. Escolha outro item, ou use este de novo na próxima rodada.'
        : `${blocker.count} dos itens selecionados já produziram resposta nesta rodada, e o mesmo item não gera duas respostas na mesma rodada. Escolha outros itens, ou use estes de novo na próxima rodada.`
  }
}

export type GenerationFailure =
  | LlmFailure
  | 'blank'
  | 'too_long'
  | 'duplicate'
  | 'ceiling'

const GENERATION_FAILURE_MESSAGES: Record<GenerationFailure, string> = {
  auth:
    'O provedor não aceitou a chave de acesso configurada no servidor. ' +
    'Confira a chave com quem cuida da instalação e gere de novo.',
  model:
    'O provedor não reconheceu o modelo configurado no servidor. ' +
    'Confira o identificador do modelo com quem cuida da instalação e gere de novo.',
  too_large:
    'Este item é grande demais para o modelo. Reduza o conteúdo do item, ' +
    'ou o texto do prompt, e gere de novo.',
  timeout:
    'A LLM demorou demais para responder e a chamada foi encerrada. ' +
    'Gere de novo para este item.',
  unavailable:
    'O provedor da LLM está fora do ar ou sobrecarregado agora. ' +
    'Gere de novo em alguns instantes.',
  unknown:
    'Não foi possível obter a resposta da LLM para este item. ' +
    'Gere de novo em alguns instantes.',
  blank:
    'A LLM devolveu uma resposta vazia, e resposta vazia não é dado de pesquisa. ' +
    'Nada foi gravado para este item; gere de novo.',
  too_long:
    `A resposta veio com mais de ${RESPONSE_TEXT_MAX} caracteres. Nada foi gravado ` +
    'para este item, porque cortar a resposta adulteraria o dado em silêncio. ' +
    'Gere de novo, ou reduza o item e o prompt.',
  duplicate:
    'Este item já tinha resposta nesta rodada quando a geração chegou nele, e o mesmo ' +
    'item não gera duas respostas na mesma rodada. Recarregue a página para ver as ' +
    'respostas da rodada.',
  ceiling:
    'O projeto atingiu o teto de respostas de LLM antes de chegar neste item. ' +
    'Fale com quem cuida da instalação para revisar o teto.',
}

export function generationFailureMessage(failure: GenerationFailure): string {
  return GENERATION_FAILURE_MESSAGES[failure]
}

export function ceilingReachedMessage(max: number): string {
  return (
    `Este projeto atingiu o teto de ${max} respostas de LLM, que existe para o teste ` +
    'não virar fatura. Fale com quem cuida da instalação para revisar o teto.'
  )
}

export function responsesLeftMessage(left: number, max: number): string {
  return left === 1
    ? `Resta 1 vaga de resposta de LLM neste projeto, de ${max}.`
    : `Restam ${left} vagas de resposta de LLM neste projeto, de ${max}.`
}

export function retryLabel(count: number): string {
  return count === 1
    ? 'Tentar de novo só este item'
    : `Tentar de novo só estes ${count} itens`
}

export function generatedCountMessage(count: number): string {
  return count === 1
    ? '1 resposta gerada e gravada com o modelo e as versões desta rodada.'
    : `${count} respostas geradas e gravadas com o modelo e as versões desta rodada.`
}

export function codebookLockedMessage(roundNumber: number): string {
  return (
    `A rodada ${roundNumber} está aberta, e o codebook fica em leitura enquanto isso, ` +
    'para que a versão que os avaliadores estão aplicando não mude debaixo deles. ' +
    'Feche a rodada para voltar a editar: a primeira alteração depois disso cria a ' +
    'versão seguinte.'
  )
}

export function closeConfirmationLines(roundNumber: number): string[] {
  return [
    `Fechar a rodada ${roundNumber} é irreversível: ela deixa de aceitar resposta e avaliação, e não existe reabrir.`,
    'O codebook volta a ser editável, e a rodada continua visível com tudo o que produziu.',
    'Fechar não espera quem ainda não terminou.',
  ]
}

export type EvaluatorProgress = { name: string; status: string; submitted: number }

export function isActiveEvaluator(evaluator: { status: string }): boolean {
  return evaluator.status === 'active'
}

export function evaluatorsNotFinished(
  evaluators: readonly EvaluatorProgress[],
  responses: number,
): string[] {
  return evaluators
    .filter(isActiveEvaluator)
    .filter((evaluator) => responses === 0 || evaluator.submitted < responses)
    .map((evaluator) => evaluator.name)
}

export function pendingEvaluatorsTitle(count: number, active: number): string {
  if (active === 0) return 'Nenhum avaliador ativo no projeto.'
  if (count === 0) return 'Todos os avaliadores ativos terminaram.'
  return count === 1
    ? '1 avaliador ainda não terminou:'
    : `${count} avaliadores ainda não terminaram:`
}

export function openRoundSummary(
  roundNumber: number,
  codebookVersionNumber: number | null,
  promptVersionNumber: number | null,
): string {
  return (
    `A rodada ${roundNumber} está aberta sobre o codebook v${codebookVersionNumber} e ` +
    `o prompt v${promptVersionNumber}.`
  )
}

export function roundInputSummary(phase: number): string {
  return phase >= PHASE_3
    ? `Rodada da Fase ${PHASE_3}: a LLM recebe o prompt, o codebook completo — título, descrição e critérios de cada definição, e os critérios gerais — e o item de entrada.`
    : `Rodada da Fase ${PHASE_2}: a LLM recebe o prompt, os títulos das definições e o item de entrada.`
}
