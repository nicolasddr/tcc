import { participationLabel, type RoundMark, type RoundTag } from '../../round-usage'

export const PARTICIPATED_BEFORE = 'já avaliou antes'

export const PARTICIPATION_HELP =
  'A marca "já avaliou antes" mostra em quais rodadas anteriores a esta cada ' +
  'avaliador já enviou avaliação. Ela não impede ninguém de avaliar: para tirar do ' +
  'cálculo quem já tinha avaliado antes, use a marca de outlier nesta rodada.'

export function participationBefore(
  participation: ReadonlyMap<string, readonly RoundTag[]>,
  roundNumber: number,
): Record<string, RoundMark> {
  const labels: Record<string, RoundMark> = {}

  for (const [memberId, tags] of participation) {
    const full = participationLabel(tags.filter((tag) => tag.roundNumber < roundNumber))
    if (full) labels[memberId] = { short: PARTICIPATED_BEFORE, full }
  }

  return labels
}
