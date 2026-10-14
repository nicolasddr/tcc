import { describe, it, expect } from 'vitest'
import {
  criteriaOfDefinition,
  definitionsWithoutCriteria,
  generalCriteria,
  isCodebookComplete,
  isGeneral,
  isPerResponse,
  isScope,
  missingCriteriaMessage,
  NOTES_PER_RESPONSE_HELP,
  notesPerResponse,
  notesPerResponseFormula,
  ownCriteria,
  perResponseCriteria,
  resolveCells,
  type Scope,
} from '@/app/projects/[id]/pipeline/criteria'

type Definition = { id: string; title: string }
type Criterion = { id: string; definitionId: string | null; scope: Scope; name: string }

const informacional: Definition = { id: 'd1', title: 'Informacional' }
const transacional: Definition = { id: 'd2', title: 'Transacional' }

function criterion(id: string, definitionId: string | null, name = id): Criterion {
  return { id, definitionId, scope: definitionId === null ? 'general' : 'specific', name }
}

function perResponse(id: string, name = id): Criterion {
  return { id, definitionId: null, scope: 'per_response', name }
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
      cells.map((cell) => [cell.definition?.title, cell.criterion.id, cell.isGeneral]),
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
        .filter((cell) => cell.definition?.id === 'd2')
        .map((cell) => cell.criterion.id),
    ).toEqual(['c2'])
  })

  it('a definição sem critério próprio nem geral não gera célula nenhuma', () => {
    const cells = resolveCells(
      [informacional, transacional],
      [criterion('c1', 'd1')],
    )

    expect(cells.map((cell) => cell.definition?.id)).toEqual(['d1'])
  })
})

describe('app/projects/[id]/pipeline/criteria — o critério próprio da definição', () => {
  it('devolve só os critérios da própria definição, sem os gerais', () => {
    const criteria = [
      criterion('c1', 'd1'),
      criterion('c2', 'd1'),
      criterion('c3', 'd2'),
      criterion('g1', null),
    ]

    expect(ownCriteria('d1', criteria).map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(criteriaOfDefinition('d1', criteria).map((c) => c.id)).toEqual([
      'c1',
      'c2',
      'g1',
    ])
  })

  it('a definição sem critério próprio fica vazia mesmo com gerais na versão', () => {
    const criteria = [criterion('c1', 'd1'), criterion('g1', null)]

    expect(ownCriteria('d2', criteria)).toEqual([])
    expect(criteriaOfDefinition('d2', criteria).map((c) => c.id)).toEqual(['g1'])
    expect(definitionsWithoutCriteria([transacional], criteria)).toEqual([])
  })

  it('mantém a ordem recebida', () => {
    const criteria = [criterion('c2', 'd1'), criterion('g1', null), criterion('c1', 'd1')]

    expect(ownCriteria('d1', criteria).map((c) => c.id)).toEqual(['c2', 'c1'])
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
  })})

describe('app/projects/[id]/pipeline/criteria — a conta mostrada no card de notas por resposta', () => {
  it('só com gerais, mostra definições vezes gerais', () => {
    expect(
      notesPerResponseFormula(
        [informacional, transacional],
        [criterion('g1', null), criterion('g2', null)],
      ),
    ).toBe('2 definições × 2 critérios gerais')
  })

  it('com gerais e específicos, soma os específicos à multiplicação', () => {
    expect(
      notesPerResponseFormula(
        [informacional, transacional],
        [criterion('g1', null), criterion('g2', null), criterion('c1', 'd1')],
      ),
    ).toBe('2 definições × 2 critérios gerais + 1 específico')
  })

  it('concorda no singular e no plural', () => {
    expect(
      notesPerResponseFormula(
        [informacional],
        [criterion('g1', null), criterion('c1', 'd1'), criterion('c2', 'd1')],
      ),
    ).toBe('1 definição × 1 critério geral + 2 específicos')
  })

  it('só com específicos, mostra a contagem deles', () => {
    expect(
      notesPerResponseFormula([informacional, transacional], [criterion('c1', 'd1')]),
    ).toBe('1 critério específico')
  })

  it('sem critério nenhum, diz que são zero', () => {
    expect(notesPerResponseFormula([informacional], [])).toBe('0 critérios')
  })

  it('o ⓘ do card fica em até 25 palavras e diz que o critério geral rende uma nota por definição', () => {
    expect(NOTES_PER_RESPONSE_HELP.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(25)
    expect(NOTES_PER_RESPONSE_HELP).toContain('Cada critério geral vira uma nota em cada definição')
    expect(NOTES_PER_RESPONSE_HELP).toContain('e não uma nota por resposta')
    expect(NOTES_PER_RESPONSE_HELP).toContain('o esforço do avaliador a cada resposta')
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

describe('app/projects/[id]/pipeline/criteria — o critério por resposta', () => {
  const queries: Definition[] = [1, 2, 3, 4, 5].map((n) => ({ id: `q${n}`, title: `Query ${n}` }))
  const criteria = [criterion('c1', 'd1'), criterion('g1', null), perResponse('r1')]

  it('não é geral nem próprio de definição nenhuma, e está entre os critérios por resposta', () => {
    expect(generalCriteria(criteria).map((c) => c.id)).toEqual(['g1'])
    expect(perResponseCriteria(criteria).map((c) => c.id)).toEqual(['r1'])
  })

  it('não entra nos critérios próprios nem nos aplicáveis de nenhuma definição', () => {
    for (const definition of [informacional, transacional]) {
      expect(ownCriteria(definition.id, criteria).map((c) => c.id)).not.toContain('r1')
      expect(criteriaOfDefinition(definition.id, criteria).map((c) => c.id)).not.toContain('r1')
    }
  })

  it('isGeneral é falso e isPerResponse é verdadeiro', () => {
    expect(isGeneral(perResponse('r1'))).toBe(false)
    expect(isPerResponse(perResponse('r1'))).toBe(true)
  })

  it('o específico e o geral não são por resposta', () => {
    expect(isPerResponse(criterion('c1', 'd1'))).toBe(false)
    expect(isPerResponse(criterion('g1', null))).toBe(false)
  })

  it('gera uma célula só, sem definição e fora dos gerais', () => {
    const cells = resolveCells([informacional, transacional], criteria)

    expect(
      cells.map((cell) => [cell.definition?.id ?? null, cell.criterion.id, cell.isGeneral]),
    ).toEqual([
      ['d1', 'c1', false],
      ['d1', 'g1', true],
      ['d2', 'g1', true],
      [null, 'r1', false],
    ])
  })

  it('no PoC, as cinco definições com o geral vêm antes, e a célula por resposta fica por último', () => {
    const cells = resolveCells(queries, [criterion('relevance', null), perResponse('diversity')])

    expect(cells).toHaveLength(6)
    expect(
      cells.slice(0, 5).map((cell) => [cell.definition?.id, cell.criterion.id]),
    ).toEqual(queries.map((query) => [query.id, 'relevance']))
    expect(cells[5].definition).toBeNull()
    expect(cells[5].criterion.id).toBe('diversity')
  })

  it('sem definição, o critério por resposta ainda gera a célula dele', () => {
    const cells = resolveCells([], [perResponse('r1')])

    expect(cells.map((cell) => [cell.definition, cell.criterion.id])).toEqual([[null, 'r1']])
  })

  it('a conta de notas do PoC dá 6', () => {
    expect(
      notesPerResponse(queries, [criterion('relevance', null), perResponse('diversity')]),
    ).toBe(6)
  })

  it('só com o critério por resposta, a conta dá 1', () => {
    expect(notesPerResponse([], [perResponse('r1')])).toBe(1)
  })

  it('a conta do card soma o por resposta ao específico', () => {
    expect(
      notesPerResponseFormula(
        [informacional, transacional],
        [criterion('g1', null), criterion('c1', 'd1'), perResponse('r1'), perResponse('r2')],
      ),
    ).toBe('2 definições × 1 critério geral + 1 específico + 2 por resposta')
  })

  it('sem geral, a conta do card soma o por resposta aos específicos', () => {
    expect(
      notesPerResponseFormula([informacional], [criterion('c1', 'd1'), perResponse('r1')]),
    ).toBe('1 critério específico + 1 por resposta')
  })

  it('só com critério por resposta, a conta do card diz quantos são', () => {
    expect(notesPerResponseFormula([informacional], [perResponse('r1')])).toBe(
      '1 critério por resposta',
    )
    expect(
      notesPerResponseFormula([informacional], [perResponse('r1'), perResponse('r2')]),
    ).toBe('2 critérios por resposta')
  })

  it('não cobre definição: só com critérios por resposta, toda definição fica descoberta', () => {
    const onlyPerResponse = [perResponse('r1'), perResponse('r2')]

    expect(
      definitionsWithoutCriteria([informacional, transacional], onlyPerResponse).map(
        (d) => d.title,
      ),
    ).toEqual(['Informacional', 'Transacional'])
  })

  it('só com critérios por resposta o codebook está incompleto', () => {
    expect(
      isCodebookComplete([informacional, transacional], [perResponse('r1')]),
    ).toBe(false)
  })

  it('com um geral a mais o codebook fica completo', () => {
    expect(
      isCodebookComplete(
        [informacional, transacional],
        [perResponse('r1'), criterion('g1', null)],
      ),
    ).toBe(true)
  })

  it('não entra como específico na conta mostrada no card', () => {
    const formula = notesPerResponseFormula(queries, [
      criterion('relevance', null),
      perResponse('diversity'),
    ])

    expect(formula).not.toContain('específico')
    expect(formula).toBe('5 definições × 1 critério geral + 1 por resposta')
  })

  it('isScope aceita os três tipos', () => {
    expect(isScope('specific')).toBe(true)
    expect(isScope('general')).toBe(true)
    expect(isScope('per_response')).toBe(true)
  })

  it('isScope recusa o que não é tipo', () => {
    expect(isScope('')).toBe(false)
    expect(isScope('geral')).toBe(false)
  })
})

describe('app/projects/[id]/pipeline/criteria — o codebook completo', () => {
  it('uma definição sem critério deixa o codebook incompleto', () => {
    expect(
      isCodebookComplete([informacional, transacional], [criterion('c1', 'd1')]),
    ).toBe(false)
  })

  it('cada definição com critério próprio completa o codebook', () => {
    expect(
      isCodebookComplete(
        [informacional, transacional],
        [criterion('c1', 'd1'), criterion('c2', 'd2')],
      ),
    ).toBe(true)
  })

  it('um critério geral cobrindo todas também completa o codebook', () => {
    expect(
      isCodebookComplete([informacional, transacional], [criterion('g1', null)]),
    ).toBe(true)
  })

  it('sem definição nenhuma não há codebook a aplicar', () => {
    expect(isCodebookComplete([], [criterion('g1', null)])).toBe(false)
    expect(isCodebookComplete([], [])).toBe(false)
  })
})
