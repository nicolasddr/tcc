import type { DbExecutor } from '@/lib/db'
import { Chip } from '@/app/components/ui/chip'
import { listRounds, type RoundSummary } from './rounds'
import { previousRoundOf, roundChanges, type RoundChanges } from './round-changes'
import { RoundChangeChips } from './round-changes-note'
import { roundInputSummary } from './preconditions'
import { closedOn } from './reference-comparison-labels'

export type RoundHeader = { round: RoundSummary; changes: RoundChanges | null }

export async function loadRoundHeader(
  projectId: string,
  roundId: string,
  tx: DbExecutor,
): Promise<RoundHeader | null> {
  const rounds = await listRounds(projectId, tx)
  const round = rounds.find((candidate) => candidate.id === roundId)
  if (!round) return null
  return { round, changes: roundChanges(round, previousRoundOf(rounds, round)) }
}

export function roundHeaderChips(header: RoundHeader) {
  const { round, changes } = header

  return (
    <div className="mt-4">
      <RoundChangeChips
        round={round}
        changes={changes}
        phaseHelp={roundInputSummary(round.phase)}
        leading={<Chip className="font-semibold text-ink">Rodada {round.roundNumber}</Chip>}
        trailing={round.closedAt ? <Chip>{closedOn(round.closedAt)}</Chip> : null}
      />
    </div>
  )
}
