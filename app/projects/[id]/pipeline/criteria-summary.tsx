import { StatCard } from '@/app/components/ui/stat'
import { plural } from '@/lib/plural'
import {
  generalCriteria,
  notesPerResponse,
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
