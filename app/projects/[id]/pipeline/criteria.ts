import { plural } from '@/lib/plural'

export type Scope = 'specific' | 'general' | 'per_response'

export type CriterionScope = { definitionId: string | null; scope: Scope }

export type DefinitionKey = { id: string }

export type CodebookCell<D, C> = {
  definition: D | null
  criterion: C
  isGeneral: boolean
}

export const PER_RESPONSE_LABEL = 'Por resposta'

export const PER_RESPONSE_CRITERIA_LABEL = 'Critérios por resposta'

export function isScope(value: string): value is Scope {
  return value === 'specific' || value === 'general' || value === 'per_response'
}

export function isGeneral(criterion: CriterionScope): boolean {
  return criterion.scope === 'general'
}

export function isPerResponse(criterion: CriterionScope): boolean {
  return criterion.scope === 'per_response'
}

export function generalCriteria<C extends CriterionScope>(
  criteria: readonly C[],
): C[] {
  return criteria.filter(isGeneral)
}

export function perResponseCriteria<C extends CriterionScope>(
  criteria: readonly C[],
): C[] {
  return criteria.filter(isPerResponse)
}

export function ownCriteria<C extends CriterionScope>(
  definitionId: string,
  criteria: readonly C[],
): C[] {
  return criteria.filter((criterion) => criterion.definitionId === definitionId)
}

export function criteriaOfDefinition<C extends CriterionScope>(
  definitionId: string,
  criteria: readonly C[],
): C[] {
  return [...ownCriteria(definitionId, criteria), ...generalCriteria(criteria)]
}

export function resolveCells<D extends DefinitionKey, C extends CriterionScope>(
  definitions: readonly D[],
  criteria: readonly C[],
): CodebookCell<D, C>[] {
  const definitionCells = definitions.flatMap((definition) =>
    criteriaOfDefinition(definition.id, criteria).map((criterion) => ({
      definition,
      criterion,
      isGeneral: isGeneral(criterion),
    })),
  )
  const perResponseCells = perResponseCriteria(criteria).map((criterion) => ({
    definition: null,
    criterion,
    isGeneral: false,
  }))
  return [...definitionCells, ...perResponseCells]
}

export function notesPerResponse(
  definitions: readonly DefinitionKey[],
  criteria: readonly CriterionScope[],
): number {
  return resolveCells(definitions, criteria).length
}

export const NOTES_PER_RESPONSE_HELP =
  'Cada critério geral vira uma nota em cada definição; cada critério por resposta, uma nota só. É o esforço do avaliador a cada resposta.'

export function notesPerResponseFormula(
  definitions: readonly DefinitionKey[],
  criteria: readonly CriterionScope[],
): string {
  const general = generalCriteria(criteria).length
  const specific = criteria.filter((criterion) => criterion.scope === 'specific').length
  const perResponse = perResponseCriteria(criteria).length
  const perResponseTerm = perResponse === 0 ? '' : ` + ${perResponse} por resposta`

  if (general === 0) {
    if (specific > 0) {
      return plural(specific, 'critério específico', 'critérios específicos') + perResponseTerm
    }
    return perResponse === 0
      ? plural(0, 'critério', 'critérios')
      : plural(perResponse, 'critério por resposta', 'critérios por resposta')
  }

  const product = `${plural(definitions.length, 'definição', 'definições')} × ${plural(general, 'critério geral', 'critérios gerais')}`
  const withSpecific =
    specific === 0 ? product : `${product} + ${plural(specific, 'específico', 'específicos')}`
  return withSpecific + perResponseTerm
}

export function definitionsWithoutCriteria<D extends DefinitionKey>(
  definitions: readonly D[],
  criteria: readonly CriterionScope[],
): D[] {
  if (generalCriteria(criteria).length > 0) return []
  return definitions.filter(
    (definition) => criteriaOfDefinition(definition.id, criteria).length === 0,
  )
}

export function isCodebookComplete(
  definitions: readonly DefinitionKey[],
  criteria: readonly CriterionScope[],
): boolean {
  return (
    definitions.length > 0 &&
    definitionsWithoutCriteria(definitions, criteria).length === 0
  )
}

export function quotedList(titles: readonly string[]): string {
  const named = titles.map((title) => `“${title}”`)
  if (named.length <= 1) return named[0] ?? ''
  return `${named.slice(0, -1).join(', ')} e ${named[named.length - 1]}`
}

export function missingCriteriaMessage(titles: readonly string[]): string {
  if (titles.length === 0) return ''

  const list = quotedList(titles)

  return titles.length === 1
    ? `A definição ${list} está sem nenhum critério. Crie um critério nela, ou um critério geral que valha para todas as definições, e salve de novo.`
    : `As definições ${list} estão sem nenhum critério. Crie um critério em cada uma, ou um critério geral que valha para todas as definições, e salve de novo.`
}
