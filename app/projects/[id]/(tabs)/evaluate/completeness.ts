import { quotedList } from '../../pipeline/criteria'
import { isScaleValue } from './scale'

export const PER_RESPONSE_KEY = 'per_response'

export type CellKey = { definitionId: string | null; criterionId: string }

export type Cell<D, C extends { id: string } = { id: string }> = {
  definition: D | null
  criterion: C
}

export type Answer = {
  definitionId: string | null
  criterionId: string
  value: string
  justification: string
}

export function cellKey(cell: CellKey): string {
  return `${cell.definitionId ?? PER_RESPONSE_KEY}_${cell.criterionId}`
}

export function cellKeyOf(cell: Cell<{ id: string }>): string {
  return cellKey({ definitionId: cell.definition?.id ?? null, criterionId: cell.criterion.id })
}

function scoredKeys(answers: readonly Answer[]): Set<string> {
  return new Set(answers.filter((answer) => isScaleValue(answer.value)).map(cellKey))
}

export function definitionsIncomplete<D extends { id: string; title: string }>(
  cells: readonly Cell<D>[],
  answers: readonly Answer[],
): D[] {
  const scored = scoredKeys(answers)
  const incomplete: D[] = []
  const seen = new Set<string>()

  for (const cell of cells) {
    const definition = cell.definition
    if (definition === null) continue
    if (scored.has(cellKeyOf(cell))) continue
    if (seen.has(definition.id)) continue
    seen.add(definition.id)
    incomplete.push(definition)
  }

  return incomplete
}

export function perResponseIncomplete<C extends { id: string; name: string }>(
  cells: readonly Cell<unknown, C>[],
  answers: readonly Answer[],
): C[] {
  const scored = scoredKeys(answers)
  return cells
    .filter(
      (cell) =>
        cell.definition === null &&
        !scored.has(cellKey({ definitionId: null, criterionId: cell.criterion.id })),
    )
    .map((cell) => cell.criterion)
}

export function isComplete<D extends { id: string }>(
  cells: readonly Cell<D>[],
  answers: readonly Answer[],
): boolean {
  const scored = scoredKeys(answers)
  return cells.every((cell) => scored.has(cellKeyOf(cell)))
}

export function incompleteMessage(
  titles: readonly string[],
  criteria: readonly string[] = [],
): string {
  if (titles.length === 0 && criteria.length === 0) return ''

  const definitionList = quotedList(titles)
  const criterionList = quotedList(criteria)

  if (criteria.length === 0) {
    return titles.length === 1
      ? `A definição ${definitionList} ainda tem critério sem nota. Dê uma nota em cada critério dela para enviar a avaliação.`
      : `As definições ${definitionList} ainda têm critério sem nota. Dê uma nota em cada critério delas para enviar a avaliação.`
  }

  if (titles.length === 0) {
    return criteria.length === 1
      ? `O critério por resposta ${criterionList} ainda está sem nota. Dê uma nota nele para enviar a avaliação.`
      : `Os critérios por resposta ${criterionList} ainda estão sem nota. Dê uma nota em cada um para enviar a avaliação.`
  }

  const definitionPart =
    titles.length === 1
      ? `A definição ${definitionList} ainda tem critério sem nota`
      : `As definições ${definitionList} ainda têm critério sem nota`
  const criterionPart =
    criteria.length === 1
      ? `o critério por resposta ${criterionList} também`
      : `os critérios por resposta ${criterionList} também`

  return `${definitionPart}, e ${criterionPart}. Dê uma nota em cada critério para enviar a avaliação.`
}
