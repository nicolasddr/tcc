import { Badge } from '@/app/components/ui/badge'
import { EmptyState } from '@/app/components/ui/empty-state'
import type {
  CodebookCriterion,
  CodebookDefinition,
} from '../../pipeline/codebook'
import { PER_RESPONSE_LABEL } from '../../pipeline/criteria'
import { PER_RESPONSE_KEY } from '../evaluate/completeness'
import type { RoundObservation } from './agreement'
import { agreementMatrix, type MatrixCell } from './agreement-matrix'
import {
  CELL_NOT_APPLICABLE,
  CELL_UNRATED_LABEL,
  agreementBand,
  bandTone,
  cellNotApplicableTitle,
  cellNotCalculableLabel,
  cellTitle,
  formatAlpha,
} from './agreement-labels'

function Cell({
  cell,
  notApplicableTitle,
}: {
  cell: MatrixCell
  notApplicableTitle: string
}) {
  if (cell.state === 'not_applicable') {
    return (
      <span className="text-muted" title={notApplicableTitle}>
        {CELL_NOT_APPLICABLE}
      </span>
    )
  }

  if (cell.state === 'unrated') {
    return <span className="text-muted">{CELL_UNRATED_LABEL}</span>
  }

  const { agreement, profile } = cell
  const title = cellTitle(agreement, profile)
  const value = agreement.calculable ? (
    <Badge tone={bandTone(agreementBand(agreement.alpha))}>
      {formatAlpha(agreement.alpha)}
    </Badge>
  ) : (
    <span className="text-muted">{cellNotCalculableLabel(agreement.reason)}</span>
  )

  return <span title={title}>{value}</span>
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
        <td
          key={entry.column.key}
          className="border-b border-line px-3 py-2 whitespace-nowrap"
        >
          <Cell
            cell={entry.cell}
            notApplicableTitle={cellNotApplicableTitle(
              row.definition === null,
              entry.column.isPerResponse,
            )}
          />
        </td>
      ))}
    </tr>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-line px-3 py-2 text-left align-bottom text-[11px] font-semibold tracking-[0.06em] text-muted uppercase"
              >
                Definição
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="border-b border-line px-3 py-2 text-left align-bottom font-semibold whitespace-nowrap text-label"
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
          </thead>
          <tbody>
            {rows.map(matrixRow)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
