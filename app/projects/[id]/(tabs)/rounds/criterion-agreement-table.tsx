import { Badge } from '@/app/components/ui/badge'
import { cx } from '@/app/components/ui/cx'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import type {
  CodebookCriterion,
  CodebookDefinition,
} from '../../pipeline/codebook'
import { PER_RESPONSE_LABEL } from '../../pipeline/criteria'
import type { RoundObservation } from './agreement'
import { criterionCells, type MatrixCell } from './agreement-matrix'
import { divergenceLabel } from './divergence'
import {
  CELL_UNRATED_LABEL,
  CRITERION_TABLE_HELP,
  CRITERION_TABLE_NOTE,
  agreementBand,
  bandTone,
  cellNotCalculableLabel,
  distributionLine,
  formatAlpha,
  sampleSize,
} from './agreement-labels'
import { formatShare } from './share'

const headerClass =
  'border-b border-line px-3 py-2 text-left align-bottom text-[11px] font-semibold ' +
  'tracking-[0.06em] text-muted uppercase'

const cellClass = 'border-b border-line px-3 py-2 whitespace-nowrap'

function Agreement({ cell }: { cell: MatrixCell }) {
  if (cell.state !== 'calculated') {
    return <span className="text-muted">{CELL_UNRATED_LABEL}</span>
  }

  const { agreement } = cell
  if (!agreement.calculable) {
    return <span className="text-muted">{cellNotCalculableLabel(agreement.reason)}</span>
  }

  return (
    <Badge tone={bandTone(agreementBand(agreement.alpha))}>
      {formatAlpha(agreement.alpha)}
    </Badge>
  )
}

function Equal({ cell }: { cell: MatrixCell }) {
  if (cell.state !== 'calculated' || !cell.profile) return null

  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className="text-ink">{formatShare(cell.profile.equal)}</span>
      <span className="text-[11.5px] text-muted">{distributionLine(cell.profile)}</span>
    </span>
  )
}

function Divergence({ cell, kind }: { cell: MatrixCell; kind: 'adjacent' | 'extreme' }) {
  if (cell.state !== 'calculated' || !cell.profile) return null

  return <span className="text-ink">{formatShare(cell.profile[kind])}</span>
}

export function CriterionAgreementTable({
  definitions,
  criteria,
  observations,
}: {
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  observations: RoundObservation[]
}) {
  const rows = criterionCells(definitions, criteria, observations)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th scope="col" className={headerClass}>
                Critério
              </th>
              <th scope="col" className={headerClass}>
                ICR
              </th>
              <th scope="col" className={headerClass}>
                Notas iguais
              </th>
              <th scope="col" className={headerClass}>
                {divergenceLabel('adjacent')}
              </th>
              <th scope="col" className={headerClass}>
                {divergenceLabel('extreme')}
              </th>
              <th scope="col" className={headerClass}>
                Notas
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ column, cell }) => (
              <tr key={column.key}>
                <th
                  scope="row"
                  className="border-b border-line px-3 py-2 text-left font-semibold whitespace-nowrap text-ink"
                >
                  <span className="flex items-center gap-1.5">
                    {column.name}
                    {column.isGeneral ? <Badge tone="neutral">Geral</Badge> : null}
                    {column.isPerResponse ? (
                      <Badge tone="neutral">{PER_RESPONSE_LABEL}</Badge>
                    ) : null}
                  </span>
                </th>
                <td className={cellClass}>
                  <Agreement cell={cell} />
                </td>
                <td className={cellClass}>
                  <Equal cell={cell} />
                </td>
                <td className={cellClass}>
                  <Divergence cell={cell} kind="adjacent" />
                </td>
                <td className={cellClass}>
                  <Divergence cell={cell} kind="extreme" />
                </td>
                <td className={cx(cellClass, 'text-muted')}>
                  {cell.state === 'calculated' ? sampleSize(cell.agreement) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="m-0 text-xs text-muted">
        {CRITERION_TABLE_NOTE} <InfoTooltip text={CRITERION_TABLE_HELP} />
      </p>
    </div>
  )
}
