import { plural } from '@/lib/plural'

export type CriterionScope = { definitionId: string | null }

export type DefinitionKey = { id: string }

export type CodebookCell<D, C> = {
  definition: D
  criterion: C
  isGeneral: boolean
}

export function isGeneral(criterion: CriterionScope): boolean {
  return criterion.definitionId === null
}

export function generalCriteria<C extends CriterionScope>(
  criteria: readonly C[],
): C[] {
  return criteria.filter(isGeneral)
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
  return definitions.flatMap((definition) =>
    criteriaOfDefinition(definition.id, criteria).map((criterion) => ({
      definition,
      criterion,
      isGeneral: isGeneral(criterion),
    })),
  )
}

export function notesPerResponse(
  definitions: readonly DefinitionKey[],
  criteria: readonly CriterionScope[],
): number {
  return resolveCells(definitions, criteria).length
}

export const NOTES_PER_RESPONSE_HELP =
  'Cada critério geral vira uma nota em cada definição, e não uma nota por resposta. É esse o esforço que o avaliador terá a cada resposta.'

export function notesPerResponseFormula(
  definitions: readonly DefinitionKey[],
  criteria: readonly CriterionScope[],
): string {
  const general = generalCriteria(criteria).length
  const specific = criteria.length - general

  if (general === 0) {
    return specific === 0
      ? plural(0, 'critério', 'critérios')
      : plural(specific, 'critério específico', 'critérios específicos')
  }

  const product = `${plural(definitions.length, 'definição', 'definições')} × ${plural(general, 'critério geral', 'critérios gerais')}`
  return specific === 0
    ? product
    : `${product} + ${plural(specific, 'específico', 'específicos')}`
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
