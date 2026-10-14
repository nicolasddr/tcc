import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { definitionTypeLabel } from '@/app/projects/definition-types'
import type { CodebookCriterion, CodebookDefinition } from './codebook'
import {
  criteriaOfDefinition,
  isGeneral,
  ownCriteria,
  PER_RESPONSE_CRITERIA_LABEL,
  perResponseCriteria,
} from './criteria'
import { preWrapClass } from '@/app/components/ui/prose'

export function DefinitionList({
  definitions,
  criteria = [],
}: {
  definitions: CodebookDefinition[]
  criteria?: CodebookCriterion[]
}) {
  const perResponse = perResponseCriteria(criteria)

  const list = (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {definitions.map((definition, index) => {
        const applicable = criteriaOfDefinition(definition.id, criteria)
        const own = ownCriteria(definition.id, criteria)

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
                <span className="flex flex-wrap items-center gap-2">
                  {own.length === 0 && applicable.length > 0 ? (
                    <Badge tone="warning">Sem critério próprio</Badge>
                  ) : null}
                  <Badge tone="accent">
                    {definitionTypeLabel(definition.type) ?? definition.type}
                  </Badge>
                </span>
              </div>

              {definition.description ? (
                <p className={`m-0 mt-2 text-[13px] ${preWrapClass} text-ink`}>
                  {definition.description}
                </p>
              ) : null}

              {applicable.length > 0 ? (
                <ul className="m-0 mt-3 flex list-none flex-col gap-2 border-t border-line p-0 pt-3">
                  {applicable.map(criterionItem)}
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

  if (perResponse.length === 0) return list

  return (
    <div className="flex flex-col gap-4">
      {list}
      <section>
        <h3 className="m-0 text-sm font-bold text-ink">{PER_RESPONSE_CRITERIA_LABEL}</h3>
        <p className="m-0 mt-1 text-[13px] text-muted">
          Julgam a resposta inteira: uma nota por resposta, sem definição.
        </p>
        <Card padding="sm" className="mt-3">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {perResponse.map(criterionItem)}
          </ul>
        </Card>
      </section>
    </div>
  )
}

function criterionItem(criterion: CodebookCriterion) {
  return (
    <li key={criterion.id}>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-ink">{criterion.name}</span>
        {isGeneral(criterion) ? <Badge tone="info">Geral</Badge> : null}
      </span>
      {criterion.description ? (
        <p className={`m-0 mt-1 text-[13px] ${preWrapClass} text-muted`}>
          {criterion.description}
        </p>
      ) : null}
    </li>
  )
}
