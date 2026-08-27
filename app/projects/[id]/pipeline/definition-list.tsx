import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { definitionTypeLabel } from '@/app/projects/definition-types'
import type { CodebookDefinition } from './codebook'

export function DefinitionList({
  definitions,
}: {
  definitions: CodebookDefinition[]
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {definitions.map((definition, index) => (
        <li key={definition.id}>
          <Card
            padding="sm"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <span className="flex items-baseline gap-2.5">
              <span className="text-[13px] font-semibold tabular-nums text-muted">
                {index + 1}
              </span>
              <span className="text-sm font-semibold text-ink">{definition.title}</span>
            </span>
            <Badge tone="accent">
              {definitionTypeLabel(definition.type) ?? definition.type}
            </Badge>
          </Card>
        </li>
      ))}
    </ul>
  )
}
