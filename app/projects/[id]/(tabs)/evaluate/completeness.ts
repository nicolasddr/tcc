import { quotedList } from '../../pipeline/criteria'
import { isScaleValue } from './scale'

export type CellKey = { definitionId: string; criterionId: string }

export type Cell<D> = { definition: D; criterion: { id: string } }

export type Answer = {
  definitionId: string
  criterionId: string
  value: string
  justification: string
}

export function cellKey(cell: CellKey): string {
  return `${cell.definitionId}_${cell.criterionId}`
}

function keyOfCell<D extends { id: string }>(cell: Cell<D>): string {
  return cellKey({ definitionId: cell.definition.id, criterionId: cell.criterion.id })
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
    if (scored.has(keyOfCell(cell))) continue
    if (seen.has(cell.definition.id)) continue
    seen.add(cell.definition.id)
    incomplete.push(cell.definition)
  }

  return incomplete
}

export function isComplete<D extends { id: string }>(
  cells: readonly Cell<D>[],
  answers: readonly Answer[],
): boolean {
  const scored = scoredKeys(answers)
  return cells.every((cell) => scored.has(keyOfCell(cell)))
}

export function incompleteMessage(titles: readonly string[]): string {
  if (titles.length === 0) return ''

  const list = quotedList(titles)

  return titles.length === 1
    ? `A definição ${list} ainda tem critério sem nota. Dê uma nota em cada critério dela para enviar a avaliação.`
    : `As definições ${list} ainda têm critério sem nota. Dê uma nota em cada critério delas para enviar a avaliação.`
}
