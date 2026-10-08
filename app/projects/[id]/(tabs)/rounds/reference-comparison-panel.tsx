import { Badge } from '@/app/components/ui/badge'
import { cx } from '@/app/components/ui/cx'
import { AgreementValue } from './agreement-panel'
import { QualitySwatch } from './quality-bar'
import { QualityValue } from './quality-panel'
import type { ComparedRound, ReferenceComparison } from './reference-comparison'
import {
  COMPARISON_EMPTY,
  closedOn,
  comparedPhase,
  comparedVersions,
  comparisonRows,
  noReferenceMessage,
  referenceLine,
  type ComparisonCell,
} from './reference-comparison-labels'
import { isOpen } from './round-status'

const cellClass = 'border-b border-line px-3 py-2'

function SideHeading({ round, isReference }: { round: ComparedRound; isReference: boolean }) {
  return (
    <th scope="col" className={cx(cellClass, 'text-right align-bottom font-normal')}>
      <span className="flex flex-col items-end gap-0.5">
        <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap text-ink">
          {`Rodada ${round.roundNumber}`}
          {isOpen(round) ? <Badge tone="info">aberta</Badge> : null}
        </span>
        <span className="text-xs whitespace-nowrap text-muted">
          {comparedPhase(round, isReference)}
        </span>
        {round.closedAt ? (
          <span className="text-xs whitespace-nowrap text-muted">{closedOn(round.closedAt)}</span>
        ) : null}
      </span>
    </th>
  )
}

function Value({ cell, secondary }: { cell: ComparisonCell; secondary: boolean }) {
  if (cell === null) return <span className="text-faint">{COMPARISON_EMPTY}</span>

  return (
    <span className={secondary || cell.muted ? 'text-muted' : 'text-ink'}>
      {cell.text}
      {cell.count === undefined ? null : (
        <span className="text-muted">{` (${cell.count})`}</span>
      )}
    </span>
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

  const { reference, round } = comparison
  const rows = comparisonRows(reference, round)

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] text-muted">{comparedVersions(reference, round)}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead>
            <tr>
              <td className={cellClass} />
              <SideHeading round={reference} isReference />
              <SideHeading round={round} isReference={false} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className={cx(
                    cellClass,
                    'text-left align-top',
                    row.secondary ? 'font-normal text-muted' : 'font-semibold text-ink',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {row.level ? <QualitySwatch value={row.level} /> : null}
                    {row.label}
                  </span>
                </th>
                {row.cells.map((cell, index) => (
                  <td
                    key={index === 0 ? reference.id : round.id}
                    className={cx(cellClass, 'text-right align-top whitespace-nowrap')}
                  >
                    <Value cell={cell} secondary={row.secondary} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
