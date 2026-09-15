import { describe, it, expect } from 'vitest'
import {
  agreementMatrix,
  matrixColumns,
  type MatrixCell,
  type MatrixRow,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import {
  CELL_NOT_APPLICABLE,
  cellNotCalculableLabel,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'

type Definition = { id: string; title: string }
type Criterion = { id: string; definitionId: string | null; name: string }

const informacional: Definition = { id: 'd1', title: 'Informacional' }
const transacional: Definition = { id: 'd2', title: 'Transacional' }

function criterion(id: string, definitionId: string | null): Criterion {
  return { id, definitionId, name: id }
}

function score(
  responseId: string,
  definitionId: string,
  criterionId: string,
  raterId: string,
  value: number,
): RoundObservation {
  return {
    unitId: `${responseId}:${definitionId}:${criterionId}`,
    raterId,
    value,
    responseId,
    definitionId,
    criterionId,
    projectMemberId: raterId,
  }
}

function ratings(
  definitionId: string,
  criterionId: string,
  byRater: Record<string, readonly number[]>,
): RoundObservation[] {
  return Object.entries(byRater).flatMap(([raterId, values]) =>
    values.map((value, index) =>
      score(`r${index + 1}`, definitionId, criterionId, raterId, value),
    ),
  )
}

function cellOf(
  row: MatrixRow<Definition, Criterion>,
  criterionId: string,
): MatrixCell {
  const found = row.cells.find((entry) => entry.column.criterion.id === criterionId)
  if (!found) throw new Error(`coluna ${criterionId} não está na matriz`)
  return found.cell
}

function alphaOf(cell: MatrixCell): number {
  if (cell.state !== 'calculated' || !cell.agreement.calculable) {
    throw new Error('célula não tem coeficiente')
  }
  return cell.agreement.alpha
}

describe('app/projects/[id]/rounds/agreement-matrix — coeficiente por célula', () => {
  it('célula que existe no codebook e ninguém avaliou fica sem nota, e não vira zero', () => {
    const criteria = [criterion('g1', null)]

    const [row] = agreementMatrix([informacional], criteria, [])

    expect(cellOf(row, 'g1')).toEqual({ state: 'unrated' })
    expect(JSON.stringify(row)).not.toContain('alpha')
  })

  it('célula não aplicável é o traço, e não um motivo de não calculável', () => {
    const criteria = [criterion('c1', 'd1')]

    const [informacionalRow, transacionalRow] = agreementMatrix(
      [informacional, transacional],
      criteria,
      [],
    )

    expect(cellOf(informacionalRow, 'c1')).toEqual({ state: 'unrated' })
    expect(cellOf(transacionalRow, 'c1')).toEqual({ state: 'not_applicable' })
    expect(CELL_NOT_APPLICABLE).not.toBe(cellNotCalculableLabel('few_evaluators'))
    expect(CELL_NOT_APPLICABLE).not.toBe(cellNotCalculableLabel('no_shared_units'))
    expect(CELL_NOT_APPLICABLE).not.toBe(cellNotCalculableLabel('no_variation'))
  })

  it('o mesmo critério geral rende uma célula por definição, com valores próprios', () => {
    const criteria = [criterion('g1', null)]

    const [informacionalRow, transacionalRow] = agreementMatrix(
      [informacional, transacional],
      criteria,
      [
        ...ratings('d1', 'g1', { A: [1, 2, 3, 1], B: [1, 2, 3, 1] }),
        ...ratings('d2', 'g1', { A: [1, 2, 3, 1], B: [1, 2, 3, 2] }),
      ],
    )

    expect(alphaOf(cellOf(informacionalRow, 'g1'))).toBe(1)
    expect(alphaOf(cellOf(transacionalRow, 'g1'))).toBeCloseTo(0.79, 10)
  })

  it('célula com um avaliador só é não calculável por poucos avaliadores', () => {
    const criteria = [criterion('g1', null)]

    const [row] = agreementMatrix(
      [informacional],
      criteria,
      ratings('d1', 'g1', { A: [1, 2, 3, 1] }),
    )

    const cell = cellOf(row, 'g1')

    expect(cell).toMatchObject({
      state: 'calculated',
      agreement: { calculable: false, reason: 'few_evaluators', raters: 1 },
    })
    expect(
      cell.state === 'calculated' &&
        !cell.agreement.calculable &&
        cellNotCalculableLabel(cell.agreement.reason),
    ).toBe('1 avaliador')
  })

  it('célula calculável traz o alpha daquele recorte, com o N da célula', () => {
    const criteria = [criterion('g1', null)]

    const [row] = agreementMatrix(
      [informacional],
      criteria,
      ratings('d1', 'g1', { A: [1, 2, 3, 1], B: [1, 2, 3, 2] }),
    )

    const cell = cellOf(row, 'g1')

    expect(cell).toMatchObject({
      state: 'calculated',
      agreement: { calculable: true, units: 4, raters: 2 },
    })
    expect(alphaOf(cell)).toBeCloseTo(0.79, 10)
  })

  it('as colunas saem gerais primeiro, depois os específicos na ordem das definições', () => {
    const criteria = [
      criterion('c2', 'd2'),
      criterion('g1', null),
      criterion('c1', 'd1'),
      criterion('g2', null),
    ]

    const columns = matrixColumns([informacional, transacional], criteria)

    expect(columns.map((column) => column.criterion.id)).toEqual([
      'g1',
      'g2',
      'c1',
      'c2',
    ])
    expect(columns.map((column) => column.isGeneral)).toEqual([true, true, false, false])
  })

  it('as linhas seguem a ordem das definições recebidas, com uma célula por coluna', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const rows = agreementMatrix([informacional, transacional], criteria, [])

    expect(rows.map((row) => row.definition.id)).toEqual(['d1', 'd2'])
    expect(rows.map((row) => row.cells.length)).toEqual([2, 2])
  })

  it('nota de uma célula não entra no coeficiente da célula vizinha', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const [row] = agreementMatrix(
      [informacional],
      criteria,
      [
        ...ratings('d1', 'g1', { A: [1, 2, 3], B: [1, 2, 3] }),
        ...ratings('d1', 'c1', { A: [3, 3, 3], B: [1, 1, 1] }),
      ],
    )

    expect(alphaOf(cellOf(row, 'g1'))).toBe(1)
    expect(alphaOf(cellOf(row, 'c1'))).toBeLessThan(0)
  })
})
