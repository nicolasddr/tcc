import { StatCard } from '@/app/components/ui/stat'
import { plural } from '@/lib/plural'
import {
  generalCriteria,
  NOTES_PER_RESPONSE_HELP,
  notesPerResponse,
  notesPerResponseFormula,
  type CriterionScope,
  type DefinitionKey,
} from './criteria'

export function NotesPerResponse({
  definitions,
  criteria,
}: {
  definitions: readonly DefinitionKey[]
  criteria: readonly CriterionScope[]
}) {
  const notes = notesPerResponse(definitions, criteria)

  return (
    <StatCard
      label="Notas por resposta"
      help={NOTES_PER_RESPONSE_HELP}
      value={notes}
      suffix={notes === 1 ? 'nota' : 'notas'}
      hint={notesPerResponseFormula(definitions, criteria)}
    />
  )
}

export function CodebookSummary({
  definitions,
  criteria,
}: {
  definitions: readonly DefinitionKey[]
  criteria: readonly CriterionScope[]
}) {
  const general = generalCriteria(criteria).length
  const own = criteria.length - general

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <NotesPerResponse definitions={definitions} criteria={criteria} />

      <StatCard
        label="Definições"
        value={definitions.length}
        suffix={definitions.length === 1 ? 'definição' : 'definições'}
        hint="A ordem da lista é a ordem em que aparecem para a equipe e vão à LLM."
      />

      <StatCard
        label="Critérios"
        value={criteria.length}
        suffix={criteria.length === 1 ? 'critério' : 'critérios'}
        hint={`${plural(own, 'próprio', 'próprios')} · ${plural(general, 'geral', 'gerais')}`}
      />
    </div>
  )
}
