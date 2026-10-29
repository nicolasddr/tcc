import { Tab, TabList } from '@/app/components/ui/tabs'
import type {
  CodebookCriterion,
  CodebookDefinition,
} from '../../pipeline/codebook'
import type { RoundObservation } from './agreement'
import { criterionCells, matrixColumns, type MatrixCell } from './agreement-matrix'
import { AgreementMatrixTable } from './agreement-matrix-table'
import {
  ALL_CRITERIA_TAB,
  CELL_UNRATED_LABEL,
  cellNotCalculableLabel,
  formatAlpha,
} from './agreement-labels'
import { CriterionByDefinitionTable } from './criterion-by-definition-table'
import { agreementCriterionHref } from './reading-shortcuts'

function tabAlpha(cell: MatrixCell | undefined): string {
  if (cell?.state !== 'calculated') return CELL_UNRATED_LABEL
  const { agreement } = cell
  return agreement.calculable
    ? formatAlpha(agreement.alpha)
    : cellNotCalculableLabel(agreement.reason)
}

export function agreementByDefinition({
  definitions,
  criteria,
  observations,
  codebookVersionNumber,
  criterion,
  href,
}: {
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  observations: RoundObservation[]
  codebookVersionNumber: number
  criterion: string | null
  href: string
}) {
  const columns = matrixColumns(definitions, criteria).filter(
    (column) => !column.isPerResponse,
  )

  if (columns.length === 1) {
    return (
      <CriterionByDefinitionTable
        definitions={definitions}
        criteria={criteria}
        observations={observations}
        columnKey={columns[0].key}
      />
    )
  }

  const active = columns.find((column) => column.key === criterion) ?? null
  const overall = new Map(
    criterionCells(definitions, criteria, observations).map(({ column, cell }) => [
      column.key,
      cell,
    ]),
  )

  return (
    <>
      <TabList>
        <Tab href={agreementCriterionHref(href, null)} active={!active}>
          {ALL_CRITERIA_TAB}
        </Tab>
        {columns.map((column) => (
          <Tab
            key={column.key}
            href={agreementCriterionHref(href, column.key)}
            active={column.key === active?.key}
          >
            {column.name}
            <span className="text-[11px] font-semibold text-faint tabular-nums">
              {tabAlpha(overall.get(column.key))}
            </span>
          </Tab>
        ))}
      </TabList>

      {active ? (
        <CriterionByDefinitionTable
          definitions={definitions}
          criteria={criteria}
          observations={observations}
          columnKey={active.key}
        />
      ) : (
        <AgreementMatrixTable
          definitions={definitions}
          criteria={criteria}
          observations={observations}
          codebookVersionNumber={codebookVersionNumber}
          href={href}
        />
      )}
    </>
  )
}
