import { describe, it, expect } from 'vitest'
import type { Scope } from '@/app/projects/[id]/pipeline/criteria'
import {
  agreementMatrix,
  matrixColumns,
  type MatrixCell,
  type MatrixRow,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix'
import type { RoundObservation } from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { PER_RESPONSE_KEY } from '@/app/projects/[id]/(tabs)/evaluate/completeness'
import {
  CELL_NOT_APPLICABLE,
  cellNotCalculableLabel,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'

type Definition = { id: string; title: string }
type Criterion = { id: string; definitionId: string | null; scope: Scope; name: string }

const informacional: Definition = { id: 'd1', title: 'Informacional' }
const transacional: Definition = { id: 'd2', title: 'Transacional' }
const navegacional: Definition = { id: 'd3', title: 'Navegacional' }

function criterion(id: string, definitionId: string | null, name = id): Criterion {
  return { id, definitionId, scope: definitionId === null ? 'general' : 'specific', name }
}

function perResponse(id: string, name = id): Criterion {
  return { id, definitionId: null, scope: 'per_response', name }
}

function score(
  responseId: string,
  definitionId: string | null,
  criterionId: string,
  raterId: string,
  value: number,
): RoundObservation {
  return {
    unitId: `${responseId}:${definitionId ?? PER_RESPONSE_KEY}:${criterionId}`,
    raterId,
    value,
    responseId,
    definitionId,
    criterionId,
    projectMemberId: raterId,
  }
}

function ratings(
  definitionId: string | null,
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
  const found = row.cells.find((entry) => entry.column.name === criterionId)
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

    expect(columns.map((column) => column.name)).toEqual(['g1', 'g2', 'c1', 'c2'])
    expect(columns.map((column) => column.isGeneral)).toEqual([true, true, false, false])
  })

  it('critérios específicos de mesmo nome em definições diferentes dividem uma coluna', () => {
    const definitions = [informacional, navegacional, transacional]
    const criteria = [
      criterion('g1', null, 'Justificativa clara'),
      criterion('c1', 'd1', 'Aderência à definição'),
      criterion('c3', 'd3', 'Aderência à definição'),
      criterion('c2', 'd2', 'Aderência à definição'),
    ]

    const columns = matrixColumns(definitions, criteria)
    const rows = agreementMatrix(definitions, criteria, [
      ...ratings('d1', 'c1', { A: [1, 2, 3, 1], B: [1, 2, 3, 1] }),
      ...ratings('d2', 'c2', { A: [1, 2, 3, 1], B: [1, 2, 3, 2] }),
    ])

    expect(columns.map((column) => column.name)).toEqual([
      'Justificativa clara',
      'Aderência à definição',
    ])
    expect(rows.map((row) => cellOf(row, 'Aderência à definição').state)).toEqual([
      'calculated',
      'unrated',
      'calculated',
    ])
    expect(alphaOf(cellOf(rows[0], 'Aderência à definição'))).toBe(1)
    expect(alphaOf(cellOf(rows[2], 'Aderência à definição'))).toBeCloseTo(0.79, 10)
  })

  it('o nome junta as colunas depois de aparar os espaços, diferenciando maiúsculas', () => {
    const criteria = [
      criterion('c1', 'd1', 'Aderência à definição'),
      criterion('c2', 'd2', '  Aderência à definição '),
      criterion('c3', 'd2', 'aderência à definição'),
    ]

    const columns = matrixColumns([informacional, transacional], criteria)

    expect(columns.map((column) => column.name)).toEqual([
      'Aderência à definição',
      'aderência à definição',
    ])
    expect(columns.map((column) => [...column.criteria.keys()])).toEqual([
      ['d1', 'd2'],
      ['d2'],
    ])
  })

  it('critério específico com o nome de um critério geral fica em coluna separada', () => {
    const criteria = [criterion('g1', null, 'Clareza'), criterion('c1', 'd1', 'Clareza')]

    const columns = matrixColumns([informacional, transacional], criteria)

    expect(columns.map((column) => [column.name, column.isGeneral])).toEqual([
      ['Clareza', true],
      ['Clareza', false],
    ])
  })

  it('dois critérios de mesmo nome na mesma definição continuam em colunas separadas', () => {
    const criteria = [criterion('c1', 'd1', 'Fonte'), criterion('c2', 'd1', 'Fonte')]

    const columns = matrixColumns([informacional], criteria)

    expect(columns.map((column) => column.criteria.get('d1')?.id)).toEqual(['c1', 'c2'])
  })

  it('as linhas seguem a ordem das definições recebidas, com uma célula por coluna', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const rows = agreementMatrix([informacional, transacional], criteria, [])

    expect(rows.map((row) => row.definition?.id)).toEqual(['d1', 'd2'])
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

describe('app/projects/[id]/rounds/agreement-matrix — a linha por resposta', () => {
  const queries: Definition[] = [1, 2, 3, 4, 5].map((n) => ({ id: `q${n}`, title: `Query ${n}` }))
  const poc = [criterion('relevance', null, 'Relevance'), perResponse('diversity', 'Diversity')]

  function perResponseRow(
    rows: readonly MatrixRow<Definition, Criterion>[],
  ): MatrixRow<Definition, Criterion> {
    const found = rows.find((row) => row.definition === null)
    if (!found) throw new Error('a linha por resposta não está na matriz')
    return found
  }

  it('a coluna do critério por resposta vem depois das outras e mapeia só a chave nula', () => {
    const columns = matrixColumns(queries, poc)

    expect(columns.map((column) => column.name)).toEqual(['Relevance', 'Diversity'])
    expect(columns.map((column) => column.isPerResponse)).toEqual([false, true])
    expect(columns.map((column) => column.isGeneral)).toEqual([true, false])
    expect([...columns[1].criteria.keys()]).toEqual([null])
  })

  it('a linha por resposta vem depois das definições, com uma célula por coluna', () => {
    const rows = agreementMatrix(queries, poc, [])

    expect(rows.map((row) => row.definition?.id ?? null)).toEqual([
      'q1',
      'q2',
      'q3',
      'q4',
      'q5',
      null,
    ])
    expect(rows.map((row) => row.cells.length)).toEqual([2, 2, 2, 2, 2, 2])
  })

  it('o critério por resposta não se aplica às definições, nem o geral à linha por resposta', () => {
    const rows = agreementMatrix(queries, poc, [])

    expect(rows.slice(0, 5).map((row) => cellOf(row, 'Diversity'))).toEqual(
      Array(5).fill({ state: 'not_applicable' }),
    )
    expect(cellOf(perResponseRow(rows), 'Relevance')).toEqual({ state: 'not_applicable' })
  })

  it('a célula por resposta tem coeficiente próprio, sem vazar para as definições', () => {
    const relevance = ratings('q1', 'relevance', { A: [3, 3, 3], B: [1, 1, 1] })
    const diversity = ratings(null, 'diversity', { A: [1, 2, 3], B: [1, 2, 3] })

    const alone = agreementMatrix(queries, poc, diversity)
    const together = agreementMatrix(queries, poc, [...relevance, ...diversity])
    const withoutPerResponse = agreementMatrix(queries, poc, relevance)

    expect(alphaOf(cellOf(perResponseRow(alone), 'Diversity'))).toBe(1)
    expect(alphaOf(cellOf(perResponseRow(together), 'Diversity'))).toBe(1)
    expect(cellOf(together[0], 'Relevance')).toEqual(cellOf(withoutPerResponse[0], 'Relevance'))
    expect(alphaOf(cellOf(together[0], 'Relevance'))).toBeLessThan(0)
  })

  it('nota sem definição num critério geral não cai em célula nenhuma', () => {
    const rows = agreementMatrix(
      queries,
      poc,
      ratings(null, 'relevance', { A: [1, 2, 3], B: [1, 2, 3] }),
    )

    expect(rows.map((row) => row.cells.map((entry) => entry.cell.state))).toEqual([
      ...Array(5).fill(['unrated', 'not_applicable']),
      ['not_applicable', 'unrated'],
    ])
  })
})
