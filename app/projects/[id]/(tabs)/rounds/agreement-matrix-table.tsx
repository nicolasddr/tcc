import { Badge } from '@/app/components/ui/badge'
import { cx } from '@/app/components/ui/cx'
import { EmptyState } from '@/app/components/ui/empty-state'
import type {
  CodebookCriterion,
  CodebookDefinition,
} from '../../pipeline/codebook'
import { PER_RESPONSE_LABEL } from '../../pipeline/criteria'
import { PER_RESPONSE_KEY } from '../evaluate/completeness'
import type { RoundObservation } from './agreement'
import { agreementMatrix, type MatrixCell } from './agreement-matrix'
import { divergenceLabel } from './divergence'
import {
  CELL_NOT_APPLICABLE,
  CELL_UNRATED_LABEL,
  agreementBand,
  bandTone,
  cellNotApplicableTitle,
  cellNotCalculableLabel,
  formatAlpha,
  sampleSize,
} from './agreement-labels'
import { formatShare } from './share'

const MEASURES = [
  'ICR',
  'Notas iguais',
  divergenceLabel('adjacent'),
  divergenceLabel('extreme'),
] as const

const cellClass = 'border-b border-line px-3 py-2 whitespace-nowrap'

const groupStartClass = 'border-l border-line'

const measureHeaderClass =
  'border-b border-line px-3 py-2 text-left align-bottom text-[11px] font-semibold ' +
  'tracking-[0.06em] text-muted uppercase'

function Cells({
  cell,
  notApplicableTitle,
}: {
  cell: MatrixCell
  notApplicableTitle: string
}) {
  if (cell.state === 'not_applicable') {
    return MEASURES.map((measure, index) => (
      <td key={measure} className={cx(cellClass, index === 0 && groupStartClass)}>
        <span className="text-muted" title={notApplicableTitle}>
          {CELL_NOT_APPLICABLE}
        </span>
      </td>
    ))
  }

  if (cell.state === 'unrated') {
    return (
      <td colSpan={MEASURES.length} className={cx(cellClass, groupStartClass)}>
        <span className="text-muted">{CELL_UNRATED_LABEL}</span>
      </td>
    )
  }

  const { agreement, profile } = cell
  const value = agreement.calculable ? (
    <Badge tone={bandTone(agreementBand(agreement.alpha))}>
      {formatAlpha(agreement.alpha)}
    </Badge>
  ) : (
    <span className="text-muted">{cellNotCalculableLabel(agreement.reason)}</span>
  )
  const share = (part: number | undefined) =>
    part === undefined ? null : <span className="text-ink">{formatShare(part)}</span>

  return (
    <>
      <td className={cx(cellClass, groupStartClass)}>
        <span title={sampleSize(agreement)}>{value}</span>
      </td>
      <td className={cellClass}>{share(profile?.equal)}</td>
      <td className={cellClass}>{share(profile?.adjacent)}</td>
      <td className={cellClass}>{share(profile?.extreme)}</td>
    </>
  )
}

export function AgreementMatrixTable({
  definitions,
  criteria,
  observations,
  codebookVersionNumber,
}: {
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  observations: RoundObservation[]
  codebookVersionNumber: number
}) {
  if (definitions.length === 0 || criteria.length === 0) {
    return (
      <EmptyState>
        A versão de codebook que esta rodada fixou (Codebook v{codebookVersionNumber})
        não tem definição e critério para cruzar, então não há matriz para montar.
      </EmptyState>
    )
  }

  const rows = agreementMatrix(definitions, criteria, observations)
  const columns = rows[0].cells.map((entry) => entry.column)

  const matrixRow = (row: (typeof rows)[number]) => (
    <tr key={row.definition?.id ?? PER_RESPONSE_KEY}>
      <th
        scope="row"
        className="border-b border-line px-3 py-2 text-left font-semibold text-ink"
      >
        {row.definition?.title ?? PER_RESPONSE_LABEL}
      </th>
      {row.cells.map((entry) => (
        <Cells
          key={entry.column.key}
          cell={entry.cell}
          notApplicableTitle={cellNotApplicableTitle(
            row.definition === null,
            entry.column.isPerResponse,
          )}
        />
      ))}
    </tr>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className={measureHeaderClass}>
                Definição
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="colgroup"
                  colSpan={MEASURES.length}
                  className={cx(
                    'border-b border-line px-3 py-2 text-left align-bottom font-semibold whitespace-nowrap text-label',
                    groupStartClass,
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {column.name}
                    {column.isGeneral ? <Badge tone="neutral">Geral</Badge> : null}
                    {column.isPerResponse ? (
                      <Badge tone="neutral">{PER_RESPONSE_LABEL}</Badge>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              {columns.flatMap((column) =>
                MEASURES.map((measure, index) => (
                  <th
                    key={`${column.key}:${measure}`}
                    scope="col"
                    className={cx(measureHeaderClass, index === 0 && groupStartClass)}
                  >
                    {measure}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(matrixRow)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
