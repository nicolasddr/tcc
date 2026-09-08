import { StatCard } from '@/app/components/ui/stat'
import {
  generalCriteria,
  notesPerResponse,
  type CriterionScope,
  type DefinitionKey,
} from './criteria'

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export function NotesPerResponse({
  definitions,
  criteria,
}: {
  definitions: readonly DefinitionKey[]
  criteria: readonly CriterionScope[]
}) {
  const notes = notesPerResponse(definitions, criteria)
  const general = generalCriteria(criteria).length
  const specific = criteria.length - general

  return (
    <StatCard
      label="Notas por resposta"
      value={notes}
      suffix={notes === 1 ? 'nota' : 'notas'}
      hint={
        <>
          {plural(definitions.length, 'definição', 'definições')} ·{' '}
          {plural(specific, 'critério específico', 'critérios específicos')} ·{' '}
          {plural(general, 'critério geral', 'critérios gerais')}. Cada critério geral
          vira uma nota em cada definição, e não uma nota por resposta — é esse o esforço
          que o avaliador terá a cada resposta.
        </>
      }
    />
  )
}
