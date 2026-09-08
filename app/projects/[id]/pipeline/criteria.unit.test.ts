import { describe, it, expect } from 'vitest'
import {
  criteriaOfDefinition,
  definitionsWithoutCriteria,
  generalCriteria,
  isGeneral,
  missingCriteriaMessage,
  notesPerResponse,
  resolveCells,
} from '@/app/projects/[id]/pipeline/criteria'

type Definition = { id: string; title: string }
type Criterion = { id: string; definitionId: string | null; name: string }

const informacional: Definition = { id: 'd1', title: 'Informacional' }
const transacional: Definition = { id: 'd2', title: 'Transacional' }

function criterion(id: string, definitionId: string | null, name = id): Criterion {
  return { id, definitionId, name }
}

describe('app/projects/[id]/pipeline/criteria — herança dos critérios gerais', () => {
  it('a definição recebe os próprios critérios e, depois, os gerais da versão', () => {
    const criteria = [
      criterion('c1', 'd1'),
      criterion('c2', 'd2'),
      criterion('g1', null),
    ]

    expect(criteriaOfDefinition('d1', criteria).map((c) => c.id)).toEqual(['c1', 'g1'])
    expect(criteriaOfDefinition('d2', criteria).map((c) => c.id)).toEqual(['c2', 'g1'])
  })

  it('a ordem dos próprios e a dos gerais é a ordem recebida', () => {
    const criteria = [
      criterion('c1', 'd1'),
      criterion('c2', 'd1'),
      criterion('g1', null),
      criterion('g2', null),
    ]

    expect(criteriaOfDefinition('d1', criteria).map((c) => c.id)).toEqual([
      'c1',
      'c2',
      'g1',
      'g2',
    ])
  })

  it('sem nenhum geral, a definição só recebe os próprios critérios', () => {
    const criteria = [criterion('c1', 'd1'), criterion('c2', 'd2')]

    expect(criteriaOfDefinition('d1', criteria).map((c) => c.id)).toEqual(['c1'])
    expect(generalCriteria(criteria)).toEqual([])
  })

  it('só o critério sem vínculo com definição é geral', () => {
    expect(isGeneral(criterion('g1', null))).toBe(true)
    expect(isGeneral(criterion('c1', 'd1'))).toBe(false)
  })

  it('as células que o avaliador recebe são a definição mais o critério, definição a definição', () => {
    const cells = resolveCells(
      [informacional, transacional],
      [criterion('c1', 'd1'), criterion('g1', null)],
    )

    expect(
      cells.map((cell) => [cell.definition.title, cell.criterion.id, cell.isGeneral]),
    ).toEqual([
      ['Informacional', 'c1', false],
      ['Informacional', 'g1', true],
      ['Transacional', 'g1', true],
    ])
  })

  it('o critério de uma definição não vaza para outra', () => {
    const cells = resolveCells(
      [informacional, transacional],
      [criterion('c1', 'd1'), criterion('c2', 'd2')],
    )

    expect(
      cells
        .filter((cell) => cell.definition.id === 'd2')
        .map((cell) => cell.criterion.id),
    ).toEqual(['c2'])
  })

  it('a definição sem critério próprio nem geral não gera célula nenhuma', () => {
    const cells = resolveCells(
      [informacional, transacional],
      [criterion('c1', 'd1')],
    )

    expect(cells.map((cell) => cell.definition.id)).toEqual(['d1'])
  })
})

describe('app/projects/[id]/pipeline/criteria — a conta de notas por resposta', () => {
  it('o critério geral rende uma nota em cada definição, e não uma por resposta', () => {
    expect(
      notesPerResponse([informacional, transacional], [criterion('g1', null)]),
    ).toBe(2)
  })

  it('a conta soma os próprios de cada definição com os gerais multiplicados', () => {
    const criteria = [
      criterion('c1', 'd1'),
      criterion('c2', 'd1'),
      criterion('c3', 'd2'),
      criterion('g1', null),
      criterion('g2', null),
    ]

    expect(notesPerResponse([informacional, transacional], criteria)).toBe(7)
  })

  it('sem definição ou sem critério, não há nota nenhuma', () => {
    expect(notesPerResponse([], [criterion('g1', null)])).toBe(0)
    expect(notesPerResponse([informacional], [])).toBe(0)
  })
})

describe('app/projects/[id]/pipeline/criteria — a definição sem régua nenhuma', () => {
  it('aponta a definição que não tem critério próprio nem herdado', () => {
    const uncovered = definitionsWithoutCriteria(
      [informacional, transacional],
      [criterion('c1', 'd1')],
    )

    expect(uncovered.map((d) => d.title)).toEqual(['Transacional'])
  })

  it('um único critério geral cobre todas as definições', () => {
    expect(
      definitionsWithoutCriteria([informacional, transacional], [criterion('g1', null)]),
    ).toEqual([])
  })

  it('sem nenhum critério, toda definição fica descoberta', () => {
    expect(
      definitionsWithoutCriteria([informacional, transacional], []).map((d) => d.title),
    ).toEqual(['Informacional', 'Transacional'])
  })

  it('a mensagem nomeia a definição que está sem critério', () => {
    expect(missingCriteriaMessage(['Transacional'])).toContain('“Transacional”')
    expect(missingCriteriaMessage(['Transacional'])).toContain('A definição')
  })

  it('a mensagem lista todas as definições sem critério', () => {
    const message = missingCriteriaMessage(['Informacional', 'Transacional', 'Navegacional'])

    expect(message).toContain('“Informacional”, “Transacional” e “Navegacional”')
    expect(message).toContain('As definições')
  })

  it('sem definição descoberta não há mensagem', () => {
    expect(missingCriteriaMessage([])).toBe('')
  })
})
