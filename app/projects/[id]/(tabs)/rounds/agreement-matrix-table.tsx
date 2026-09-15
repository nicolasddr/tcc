import { Badge } from '@/app/components/ui/badge'
import { EmptyState } from '@/app/components/ui/empty-state'
import type {
  CodebookCriterion,
  CodebookDefinition,
} from '../../pipeline/codebook'
import type { RoundObservation } from './agreement'
import { agreementMatrix, type MatrixCell } from './agreement-matrix'
import {
  CELL_NOT_APPLICABLE,
  CELL_NOT_APPLICABLE_TITLE,
  CELL_UNRATED_LABEL,
  MATRIX_LEGEND,
  agreementBand,
  bandTone,
  cellNotCalculableLabel,
  formatAlpha,
  sampleSize,
} from './agreement-labels'

function Cell({ cell }: { cell: MatrixCell }) {
  if (cell.state === 'not_applicable') {
    return (
      <span className="text-faint" title={CELL_NOT_APPLICABLE_TITLE}>
        {CELL_NOT_APPLICABLE}
      </span>
    )
  }

  if (cell.state === 'unrated') {
    return <span className="text-muted">{CELL_UNRATED_LABEL}</span>
  }

  const { agreement } = cell

  if (!agreement.calculable) {
    return (
      <span className="text-muted" title={sampleSize(agreement)}>
        {cellNotCalculableLabel(agreement.reason)}
      </span>
    )
  }

  return (
    <span title={sampleSize(agreement)}>
      <Badge tone={bandTone(agreementBand(agreement.alpha))}>
        {formatAlpha(agreement.alpha)}
      </Badge>
    </span>
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
                  key={column.criterion.id}
                  scope="col"
                  className="border-b border-line px-3 py-2 text-left align-bottom font-semibold whitespace-nowrap text-label"
                >
                  <span className="flex items-center gap-1.5">
                    {column.criterion.name}
                    {column.isGeneral ? <Badge tone="neutral">geral</Badge> : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.definition.id}>
                <th
                  scope="row"
                  className="border-b border-line px-3 py-2 text-left font-semibold text-ink"
                >
                  {row.definition.title}
                </th>
                {row.cells.map((entry) => (
                  <td
                    key={entry.column.criterion.id}
                    className="border-b border-line px-3 py-2 whitespace-nowrap"
                  >
                    <Cell cell={entry.cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="m-0 text-xs text-muted">
        A matriz é da versão de codebook que a rodada fixou, Codebook v
        {codebookVersionNumber}, e não da versão vigente do projeto.
      </p>

      <p className="m-0 text-xs text-muted">{MATRIX_LEGEND}</p>
    </div>
  )
}
