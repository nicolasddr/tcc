import { plural } from '@/lib/plural'
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
  | { key: 'finished'; roundNumber: number; total: number }

export type WaitingInputs = {
  phase: number
  definitions: readonly DefinitionKey[]
  criteria: readonly CriterionScope[]
  openRound: { roundNumber: number } | null
  total: number
  evaluated: number
}

export function waitingState(inputs: WaitingInputs): WaitingState | null {
  if (!inputs.openRound) {
    const complete =
      inputs.phase >= PHASE_2 && isCodebookComplete(inputs.definitions, inputs.criteria)

    return complete ? { key: 'round' } : { key: 'codebook' }
  }

  const { roundNumber } = inputs.openRound

  if (inputs.total === 0) return { key: 'responses', roundNumber }

  if (inputs.evaluated >= inputs.total) {
    return { key: 'finished', roundNumber, total: inputs.total }
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
    case 'finished':
      return (
        `Você terminou: ${plural(state.total, 'resposta avaliada', 'respostas avaliadas')} ` +
        `na rodada ${state.roundNumber}. Agora a rodada aguarda o fechamento pelo ` +
        'administrador.'
      )
  }
}
