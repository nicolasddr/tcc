import { PHASE_3 } from '../../pipeline/preconditions'
import { QUALITY_LABEL } from './quality-labels'
import type { Change } from './round-changes'

export function changesHeading(previousRoundNumber: number): string {
  return `Em relação à rodada ${previousRoundNumber}`
}

export function codebookChangeText(change: Change): string {
  return change.changed
    ? `Codebook: v${change.from} → v${change.to}`
    : `Codebook: v${change.to}, o mesmo`
}

export function promptChangeText(change: Change): string {
  return change.changed
    ? `Prompt: v${change.from} → v${change.to}`
    : `Prompt: v${change.to}, o mesmo`
}

export function phaseChangeText(change: Change): string {
  return change.changed
    ? `Fase: ${change.from} → ${change.to}`
    : `Fase: ${change.to}, a mesma`
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
