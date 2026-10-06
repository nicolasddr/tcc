import { formatDate } from '@/app/notifications/labels'
import { PHASE_3 } from '../../pipeline/preconditions'

export const REFERENCE_COMPARISON_TITLE = 'Comparação com a rodada de referência'

export const REFERENCE_COMPARISON_HELP =
  'A rodada de referência é a que validou as versões de codebook e de prompt que a Fase 4 ' +
  'testa. Os dois lados vêm do mesmo cálculo da lista de rodadas, cada um com as suas notas ' +
  'e as suas marcas de outlier. A ferramenta não diz se a diferença basta: quem lê é você.'

export function referenceComparisonHint(roundNumber: number, referenceNumber: number): string {
  return (
    `A rodada ${roundNumber} ao lado da rodada ${referenceNumber}, a última fechada da ` +
    `Fase ${PHASE_3} antes dela.`
  )
}

export function referenceSentence(reference: {
  roundNumber: number
  closedAt: string | null
  codebookVersionNumber: number
  promptVersionNumber: number
}): string {
  const closed = reference.closedAt ? `, fechada em ${formatDate(reference.closedAt)}` : ''
  return (
    `Rodada de referência: rodada ${reference.roundNumber}${closed}. Ela validou o codebook ` +
    `na versão ${reference.codebookVersionNumber} e o prompt na versão ` +
    `${reference.promptVersionNumber}.`
  )
}

export function referenceLine(reference: {
  roundNumber: number
  codebookVersionNumber: number
  promptVersionNumber: number
}): string {
  return (
    `Rodada de referência: rodada ${reference.roundNumber} · Codebook ` +
    `v${reference.codebookVersionNumber} · Prompt v${reference.promptVersionNumber}`
  )
}

export function noReferenceMessage(roundNumber: number): string {
  return (
    `Não há rodada fechada da Fase ${PHASE_3} antes da rodada ${roundNumber}, e por isso não ` +
    'há com o que comparar.'
  )
}
