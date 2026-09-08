import {
  definitionsWithoutCriteria,
  quotedList,
  type CriterionScope,
  type DefinitionKey,
} from '../pipeline/criteria'
import { PHASE_2 } from '../pipeline/preconditions'

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

  if (inputs.definitions.length === 0) {
    blockers.push({ key: 'definition' })
  } else {
    const uncovered = definitionsWithoutCriteria(inputs.definitions, inputs.criteria)
    if (uncovered.length > 0) {
      blockers.push({ key: 'criteria', titles: uncovered.map((d) => d.title) })
    }
  }

  if (!inputs.hasPromptVersion) blockers.push({ key: 'prompt' })

  return blockers
}

export function canOpenRound(inputs: RoundInputs): boolean {
  return roundBlockers(inputs).length === 0
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

export function codebookLockedMessage(roundNumber: number): string {
  return (
    `A rodada ${roundNumber} está aberta, e o codebook fica em leitura enquanto isso, ` +
    'para que a versão que os avaliadores estão aplicando não mude debaixo deles. ' +
    'Feche a rodada para voltar a editar: a primeira alteração depois disso cria a ' +
    'versão seguinte.'
  )
}

export function closeConfirmationLines(
  roundNumber: number,
  evaluatorsNotFinished: readonly string[],
): string[] {
  const pending =
    evaluatorsNotFinished.length === 0
      ? 'Este projeto ainda não tem nenhum avaliador ativo, então não há avaliação a esperar.'
      : `Ainda não terminaram: ${evaluatorsNotFinished.join(', ')}.`

  return [
    `Fechar a rodada ${roundNumber} é irreversível: ela não volta a aceitar resposta nem avaliação, e não existe reabrir. A rodada continua visível, com tudo o que produziu.`,
    `Fechar não depende de todos terem terminado. ${pending}`,
    'Fechar destrava a edição do codebook, e a primeira alteração depois disso cria a versão seguinte.',
    'Cancelar não muda nada.',
  ]
}
