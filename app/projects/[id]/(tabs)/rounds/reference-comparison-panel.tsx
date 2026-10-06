import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { formatDate } from '@/app/notifications/labels'
import { AgreementValue } from './agreement-panel'
import { QualityValue } from './quality-panel'
import type { ComparedRound, ReferenceComparison } from './reference-comparison'
import { noReferenceMessage, referenceLine, referenceSentence } from './reference-comparison-labels'
import { isOpen } from './round-status'

function comparedSide(round: ComparedRound) {
  return (
    <Card key={round.id} tone="subtle" padding="sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-semibold text-ink">
          {`Rodada ${round.roundNumber}`}
          <span className="font-normal text-muted">{` · Fase ${round.phase}`}</span>
        </span>
        {isOpen(round) ? <Badge tone="info">aberta</Badge> : null}
      </div>

      <p className="m-0 mt-1.5 text-[13px] text-muted">
        {`Codebook v${round.codebookVersionNumber} · Prompt v${round.promptVersionNumber}`}
      </p>

      {round.closedAt ? (
        <p className="m-0 mt-1.5 text-[13px] text-muted">
          {`fechada em ${formatDate(round.closedAt)}`}
        </p>
      ) : null}

      <AgreementValue pair={round.agreement} band={false} />
      {round.quality ? <QualityValue pair={round.quality} /> : null}
    </Card>
  )
}

export function ReferenceComparisonPanel({
  roundNumber,
  comparison,
}: {
  roundNumber: number
  comparison: Exclude<ReferenceComparison, { kind: 'not_phase_4' }>
}) {
  if (comparison.kind === 'no_reference') {
    return <p className="m-0 text-[13px] text-muted">{noReferenceMessage(roundNumber)}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px] text-ink">{referenceSentence(comparison.reference)}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[comparison.reference, comparison.round].map(comparedSide)}
      </div>
    </div>
  )
}

export function ReferenceRoundLine({ reference }: { reference: ComparedRound }) {
  return (
    <div className="mt-2 border-t border-line pt-2">
      <p className="m-0 text-[13px] text-muted">{referenceLine(reference)}</p>
      <AgreementValue pair={reference.agreement} band={false} />
      {reference.quality ? <QualityValue pair={reference.quality} /> : null}
    </div>
  )
}
