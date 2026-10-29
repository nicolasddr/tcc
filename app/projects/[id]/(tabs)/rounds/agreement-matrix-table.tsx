import { Badge } from '@/app/components/ui/badge'
import { EmptyState } from '@/app/components/ui/empty-state'
import type {
  CodebookCriterion,
  CodebookDefinition,
} from '../../pipeline/codebook'
import { isPerResponse } from '../../pipeline/criteria'
import type { RoundObservation } from './agreement'
import { agreementMatrix, type MatrixCell } from './agreement-matrix'
import { DivergenceBar } from './divergence-bar'
import {
  CELL_NOT_APPLICABLE,
  CELL_NOT_APPLICABLE_TITLE,
  CELL_UNRATED_LABEL,
  agreementBand,
  bandTone,
  cellNotCalculableLabel,
  formatAlpha,
  sampleSize,
} from './agreement-labels'

const cellClass = 'border-b border-line px-2.5 py-1.5 align-middle whitespace-nowrap'

const definitionHeaderClass =
  'border-b border-line px-3 py-2 text-left align-bottom text-[11px] font-semibold ' +
  'tracking-[0.06em] text-muted uppercase'

function HeatCell({ cell }: { cell: MatrixCell }) {
  if (cell.state === 'not_applicable') {
    return (
      <td className={cellClass}>
        <span className="text-muted" title={CELL_NOT_APPLICABLE_TITLE}>
          {CELL_NOT_APPLICABLE}
        </span>
      </td>
    )
  }

  if (cell.state === 'unrated') {
    return (
      <td className={cellClass}>
        <span className="text-muted">{CELL_UNRATED_LABEL}</span>
      </td>
    )
  }

  const { agreement, profile } = cell
  const value = agreement.calculable ? (
    <Badge tone={bandTone(agreementBand(agreement.alpha))} className="tabular-nums">
      {formatAlpha(agreement.alpha)}
    </Badge>
  ) : (
    <span className="text-muted">{cellNotCalculableLabel(agreement.reason)}</span>
  )

  return (
    <td className={cellClass}>
      <span className="inline-flex flex-col items-start gap-1">
        <span title={sampleSize(agreement)}>{value}</span>
        {profile ? <DivergenceBar profile={profile} compact /> : null}
      </span>
    </td>
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
  const byDefinition = criteria.filter((criterion) => !isPerResponse(criterion))

  if (definitions.length === 0 || byDefinition.length === 0) {
    return (
      <EmptyState>
        A versão de codebook que esta rodada fixou (Codebook v{codebookVersionNumber})
        não tem definição e critério para cruzar, então não há matriz para montar.
      </EmptyState>
    )
  }

  const rows = agreementMatrix(definitions, byDefinition, observations)
  const columns = rows[0].cells.map((entry) => entry.column)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th scope="col" className={definitionHeaderClass}>
              Definição
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="border-b border-line px-2.5 py-2 text-left align-bottom text-[12.5px] font-semibold whitespace-nowrap text-label"
              >
                <span className="flex items-center gap-1.5">
                  {column.name}
                  {column.isGeneral ? <Badge tone="neutral">Geral</Badge> : null}
                </span>
              </th>
            ))}
            <td className="w-full border-b border-line" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ definition, cells }) =>
            definition ? (
              <tr key={definition.id}>
                <th
                  scope="row"
                  className="border-b border-line px-3 py-1.5 text-left font-semibold whitespace-nowrap text-ink"
                >
                  {definition.title}
                </th>
                {cells.map((entry) => (
                  <HeatCell key={entry.column.key} cell={entry.cell} />
                ))}
                <td className="border-b border-line" />
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
    </div>
  )
}
