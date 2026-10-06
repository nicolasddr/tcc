import { participationLabel, type RoundTag } from '../../round-usage'

export const PARTICIPATION_HELP =
  'A marca "avaliou nas rodadas" mostra em quais rodadas anteriores a esta cada ' +
  'avaliador já enviou avaliação. Ela não impede ninguém de avaliar: para tirar do ' +
  'cálculo quem já tinha avaliado antes, use a marca de outlier nesta rodada.'

export function participationBefore(
  participation: ReadonlyMap<string, readonly RoundTag[]>,
  roundNumber: number,
): Record<string, string> {
  const labels: Record<string, string> = {}

  for (const [memberId, tags] of participation) {
    const label = participationLabel(tags.filter((tag) => tag.roundNumber < roundNumber))
    if (label) labels[memberId] = label
  }

  return labels
}
