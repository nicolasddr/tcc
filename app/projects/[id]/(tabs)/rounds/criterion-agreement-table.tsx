import { Badge } from '@/app/components/ui/badge'
import { cx } from '@/app/components/ui/cx'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import type {
  CodebookCriterion,
  CodebookDefinition,
} from '../../pipeline/codebook'
import { PER_RESPONSE_LABEL } from '../../pipeline/criteria'
import type { RoundObservation } from './agreement'
import { criterionAgreements, type MatrixCell } from './agreement-matrix'
import { DIVERGENCE_BAR_HEADER } from './divergence'
import { DivergenceBar } from './divergence-bar'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  BAND_REFERENCE,
  CELL_UNRATED_LABEL,
  CONCENTRATED_LABEL,
  CONCENTRATION_HELP,
  agreementBand,
  bandTone,
  cellNotCalculableLabel,
  concentrationWarning,
  formatAlpha,
  notesCount,
} from './agreement-labels'

const headerClass =
  'border-b border-line px-3 py-2 text-left align-bottom text-[11px] font-semibold ' +
  'tracking-[0.06em] text-muted uppercase'

const cellClass = 'border-b border-line px-3 py-2 align-top whitespace-nowrap'

function Agreement({ cell }: { cell: MatrixCell }) {
  if (cell.state !== 'calculated') {
    return <span className="text-muted">{CELL_UNRATED_LABEL}</span>
  }

  const { agreement } = cell
  if (!agreement.calculable) {
    return <span className="text-muted">{cellNotCalculableLabel(agreement.reason)}</span>
  }

  return (
    <Badge tone={bandTone(agreementBand(agreement.alpha))} className="tabular-nums">
      {formatAlpha(agreement.alpha)}
    </Badge>
  )
}

function AgreementPair({
  cell,
  withoutOutliers,
}: {
  cell: MatrixCell
  withoutOutliers: MatrixCell | null
}) {
  if (!withoutOutliers) return <Agreement cell={cell} />

  return (
    <span className="flex flex-col items-end gap-1.5">
      <span className="flex flex-col items-end gap-0.5">
        <span className="text-[11px] text-muted">{AGREEMENT_ALL_LABEL}</span>
        <Agreement cell={cell} />
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <span className="text-[11px] text-muted">{AGREEMENT_WITHOUT_OUTLIERS_LABEL}</span>
        <Agreement cell={withoutOutliers} />
      </span>
    </span>
  )
}

function Divergence({ cell }: { cell: MatrixCell }) {
  if (cell.state !== 'calculated' || !cell.profile) return null

  return <DivergenceBar profile={cell.profile} />
}

export function CriterionAgreementTable({
  definitions,
  criteria,
  observations,
  excluded,
}: {
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  observations: RoundObservation[]
  excluded: ReadonlySet<string>
}) {
  const rows = criterionAgreements(definitions, criteria, observations, excluded)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th scope="col" className={headerClass}>
                Critério
              </th>
              <th scope="col" className={cx(headerClass, 'text-right')}>
                <span className="inline-flex items-center gap-1">
                  ICR <InfoTooltip text={BAND_REFERENCE} />
                </span>
              </th>
              <th scope="col" className={cx(headerClass, 'whitespace-nowrap')}>
                {DIVERGENCE_BAR_HEADER}
              </th>
              <td className="w-full border-b border-line" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ column, cell, withoutOutliers }) => {
              const warning =
                cell.state === 'calculated'
                  ? concentrationWarning(cell.agreement, cell.profile)
                  : null

              return (
                <tr key={column.key}>
                  <th
                    scope="row"
                    className="border-b border-line px-3 py-2 text-left align-top font-semibold whitespace-nowrap text-ink"
                  >
                    <span className="flex items-center gap-1.5">
                      {column.name}
                      {column.isGeneral ? <Badge tone="neutral">Geral</Badge> : null}
                      {column.isPerResponse ? (
                        <Badge tone="neutral">{PER_RESPONSE_LABEL}</Badge>
                      ) : null}
                      {warning ? (
                        <>
                          <Badge tone="warning">{CONCENTRATED_LABEL}</Badge>
                          <InfoTooltip text={`${warning} ${CONCENTRATION_HELP}`} />
                        </>
                      ) : null}
                    </span>
                    {cell.state === 'calculated' ? (
                      <span className="block text-[11.5px] font-normal text-muted">
                        {notesCount(cell.agreement)}
                      </span>
                    ) : null}
                  </th>
                  <td className={cx(cellClass, 'text-right')}>
                    <AgreementPair cell={cell} withoutOutliers={withoutOutliers} />
                  </td>
                  <td className={cellClass}>
                    <Divergence cell={cell} />
                  </td>
                  <td className="border-b border-line" />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
