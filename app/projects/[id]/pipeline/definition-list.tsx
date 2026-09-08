import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { definitionTypeLabel } from '@/app/projects/definition-types'
import type { CodebookCriterion, CodebookDefinition } from './codebook'
import { criteriaOfDefinition, isGeneral } from './criteria'

export function DefinitionList({
  definitions,
  criteria = [],
}: {
  definitions: CodebookDefinition[]
  criteria?: CodebookCriterion[]
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {definitions.map((definition, index) => {
        const applicable = criteriaOfDefinition(definition.id, criteria)

        return (
          <li key={definition.id}>
            <Card padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-baseline gap-2.5">
                  <span className="text-[13px] font-semibold tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {definition.title}
                  </span>
                </span>
                <Badge tone="accent">
                  {definitionTypeLabel(definition.type) ?? definition.type}
                </Badge>
              </div>

              {definition.description ? (
                <p className="m-0 mt-2 text-[13px] break-words whitespace-pre-wrap text-ink">
                  {definition.description}
                </p>
              ) : null}

              {applicable.length > 0 ? (
                <ul className="m-0 mt-3 flex list-none flex-col gap-2 border-t border-line p-0 pt-3">
                  {applicable.map((criterion) => (
                    <li key={criterion.id}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink">
                          {criterion.name}
                        </span>
                        {isGeneral(criterion) ? (
                          <Badge tone="info">geral</Badge>
                        ) : null}
                      </span>
                      {criterion.description ? (
                        <p className="m-0 mt-1 text-[13px] break-words whitespace-pre-wrap text-muted">
                          {criterion.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : criteria.length > 0 ? (
                <p className="m-0 mt-3 text-[13px] text-muted">
                  Sem critério nesta definição.
                </p>
              ) : null}
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
