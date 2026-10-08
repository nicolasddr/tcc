import { PHASE_3, PHASE_4 } from '../../pipeline/preconditions'
import { QUALITY_LABEL } from './quality-labels'
import type { Change } from './round-changes'

export function codebookChipText(change: Change): string {
  return change.changed ? `Codebook v${change.from} → v${change.to}` : `Codebook v${change.to}`
}

export function promptChipText(change: Change): string {
  return change.changed ? `Prompt v${change.from} → v${change.to}` : `Prompt v${change.to}`
}

export function phaseChipText(change: Change): string {
  return change.changed ? `Fase ${change.from} → ${change.to}` : `Fase ${change.to}`
}

export const CODEBOOK_AND_PROMPT_NOTICE =
  'O codebook e o prompt mudaram juntos em relação à rodada anterior: uma diferença ' +
  `no ICR ou na ${QUALITY_LABEL} desta rodada não se atribui a um nem ao outro.`

export const CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE =
  'Além da forma de montar a entrada, mudou também a versão de codebook, a de prompt ' +
  `ou as duas: uma diferença no ICR ou na ${QUALITY_LABEL} desta rodada não se ` +
  'atribui a um nem ao outro, nem só à forma de montar a entrada.'

export const ENTERS_PHASE_3_NOTE =
  `Primeira rodada da Fase ${PHASE_3}: a mudança principal foi a forma de montar a ` +
  'entrada, que passou a levar o codebook completo à LLM junto com o prompt e o item ' +
  'de entrada.'

export function entersPhase4Note(referenceRoundNumber: number): string {
  return (
    `Primeira rodada da Fase ${PHASE_4}: o codebook e o prompt são os mesmos da rodada de ` +
    `referência, a rodada ${referenceRoundNumber}. O que deve mudar são os itens de entrada e ` +
    'os avaliadores.'
  )
}
