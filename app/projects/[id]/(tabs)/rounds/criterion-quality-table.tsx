import { Badge } from '@/app/components/ui/badge'
import type {
  CodebookCriterion,
  CodebookDefinition,
} from '../../pipeline/codebook'
import { PER_RESPONSE_LABEL } from '../../pipeline/criteria'
import type { RoundObservation } from './agreement'
import { qualityByCriterion } from './quality'
import { QualityCell } from './quality-cell'

const headerClass =
  'border-b border-line px-3 py-2 text-left align-bottom text-[11px] font-semibold ' +
  'tracking-[0.06em] text-muted uppercase'

export function CriterionQualityTable({
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
  const rows = qualityByCriterion(definitions, criteria, observations, excluded)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th scope="col" className={headerClass}>
              Critério
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
                className="border-b border-line px-3 py-2 text-left align-top font-semibold whitespace-nowrap text-ink"
              >
                <span className="flex items-center gap-1.5">
                  {column.name}
                  {column.isGeneral ? <Badge tone="neutral">Geral</Badge> : null}
                  {column.isPerResponse ? (
                    <Badge tone="neutral">{PER_RESPONSE_LABEL}</Badge>
                  ) : null}
                </span>
              </th>
              <td className="border-b border-line px-3 py-2 align-top">
                <QualityCell cell={cell} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
