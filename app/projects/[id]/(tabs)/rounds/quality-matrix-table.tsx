import { Badge } from '@/app/components/ui/badge'
import { EmptyState } from '@/app/components/ui/empty-state'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import type {
  CodebookCriterion,
  CodebookDefinition,
} from '../../pipeline/codebook'
import type { RoundObservation } from './agreement'
import type { MeasuredCell } from './agreement-matrix'
import { qualityMatrix, type Quality, type QualityPair } from './quality'
import {
  QUALITY_MATRIX_LEGEND,
  QUALITY_UNRATED,
  QUALITY_UNRATED_WITHOUT_OUTLIERS,
  levelText,
} from './quality-labels'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  CELL_NOT_APPLICABLE,
  CELL_NOT_APPLICABLE_TITLE,
  CELL_UNRATED_LABEL,
} from './agreement-labels'

function Levels({
  label,
  quality,
  unrated,
}: {
  label?: string
  quality: Quality
  unrated: string
}) {
  return (
    <span className="flex flex-col">
      {label ? <span className="text-[11px] text-muted">{label}</span> : null}
      {quality.rated ? (
        quality.levels.map((level) => (
          <span key={level.value} className="text-ink">
            {levelText(level)}
          </span>
        ))
      ) : (
        <span className="text-muted">{unrated}</span>
      )}
    </span>
  )
}

function Cell({ cell }: { cell: MeasuredCell<QualityPair> }) {
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

  const { all, withoutOutliers } = cell.value

  if (!withoutOutliers) {
    return <Levels quality={all} unrated={QUALITY_UNRATED} />
  }

  return (
    <span className="flex flex-col gap-2">
      <Levels label={AGREEMENT_ALL_LABEL} quality={all} unrated={QUALITY_UNRATED} />
      <Levels
        label={AGREEMENT_WITHOUT_OUTLIERS_LABEL}
        quality={withoutOutliers}
        unrated={QUALITY_UNRATED_WITHOUT_OUTLIERS}
      />
    </span>
  )
}

export function QualityMatrixTable({
  definitions,
  criteria,
  observations,
  excluded,
  codebookVersionNumber,
}: {
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  observations: RoundObservation[]
  excluded: ReadonlySet<string>
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

  const rows = qualityMatrix(definitions, criteria, observations, excluded)
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
                  className="border-b border-line px-3 py-2 text-left align-top font-semibold text-ink"
                >
                  {row.definition.title}
                </th>
                {row.cells.map((entry) => (
                  <td
                    key={entry.column.criterion.id}
                    className="border-b border-line px-3 py-2 align-top whitespace-nowrap"
                  >
                    <Cell cell={entry.cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="m-0 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          A matriz é da versão de codebook que a rodada fixou, Codebook v
          {codebookVersionNumber}, e não da versão vigente do projeto.
        </span>
        <InfoTooltip text={QUALITY_MATRIX_LEGEND} />
      </p>
    </div>
  )
}
