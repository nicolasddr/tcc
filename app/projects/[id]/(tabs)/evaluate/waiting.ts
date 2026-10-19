import {
  isCodebookComplete,
  type CriterionScope,
  type DefinitionKey,
} from '../../pipeline/criteria'
import { PHASE_2 } from '../../pipeline/preconditions'

export type WaitingState =
  | { key: 'codebook' }
  | { key: 'round' }
  | { key: 'responses'; roundNumber: number }

export type WaitingInputs = {
  phase: number
  definitions: readonly DefinitionKey[]
  criteria: readonly CriterionScope[]
  openRound: { roundNumber: number } | null
  total: number
}

export function waitingState(inputs: WaitingInputs): WaitingState | null {
  if (!inputs.openRound) {
    const complete =
      inputs.phase >= PHASE_2 && isCodebookComplete(inputs.definitions, inputs.criteria)

    return complete ? { key: 'round' } : { key: 'codebook' }
  }

  if (inputs.total === 0) {
    return { key: 'responses', roundNumber: inputs.openRound.roundNumber }
  }

  return null
}

export function waitingMessage(state: WaitingState): string {
  switch (state.key) {
    case 'codebook':
      return (
        'O administrador ainda está montando o codebook deste projeto. Quando ele ' +
        'terminar e abrir uma rodada, as respostas dela aparecem aqui para avaliar.'
      )
    case 'round':
      return (
        'O codebook deste projeto já está pronto, e o projeto não tem rodada aberta ' +
        'agora. Está aguardando o administrador abrir uma rodada.'
      )
    case 'responses':
      return (
        `A rodada ${state.roundNumber} foi aberta e ainda não tem resposta gerada. ` +
        'Está aguardando o administrador gerar as respostas.'
      )
  }
}
