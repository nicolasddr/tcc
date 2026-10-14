import { describe, it, expect } from 'vitest'
import { resolveCells, type Scope } from '@/app/projects/[id]/pipeline/criteria'
import {
  cellKey,
  definitionsIncomplete,
  incompleteMessage,
  isComplete,
  perResponseIncomplete,
  type Answer,
} from '@/app/projects/[id]/(tabs)/evaluate/completeness'

type Definition = { id: string; title: string }
type Criterion = { id: string; definitionId: string | null; scope: Scope; name: string }

const informacional: Definition = { id: 'd1', title: 'Informacional' }
const transacional: Definition = { id: 'd2', title: 'Transacional' }

const definitions = [informacional, transacional]

const criteria: Criterion[] = [
  { id: 'c1', definitionId: 'd1', scope: 'specific', name: 'Clareza' },
  { id: 'c2', definitionId: 'd2', scope: 'specific', name: 'Precisão' },
  { id: 'g1', definitionId: null, scope: 'general', name: 'Aderência' },
]

const cells = resolveCells(definitions, criteria)

function answer(
  definitionId: string | null,
  criterionId: string,
  value = 'high',
  justification = '',
): Answer {
  return { definitionId, criterionId, value, justification }
}

const allAnswers = cells.map((cell) => answer(cell.definition?.id ?? null, cell.criterion.id))

describe('app/projects/[id]/evaluate/completeness — a mesma regra na tela e no servidor', () => {
  it('a chave da célula junta definição e critério', () => {
    expect(cellKey({ definitionId: 'd1', criterionId: 'g1' })).toBe('d1_g1')
    expect(cellKey({ definitionId: 'd2', criterionId: 'g1' })).toBe('d2_g1')
  })

  it('com nota em todas as células, a avaliação está completa', () => {
    expect(isComplete(cells, allAnswers)).toBe(true)
    expect(definitionsIncomplete(cells, allAnswers)).toEqual([])
  })

  it('sem nenhuma nota, todas as definições estão incompletas, na ordem do codebook', () => {
    expect(definitionsIncomplete(cells, [])).toEqual([informacional, transacional])
    expect(isComplete(cells, [])).toBe(false)
  })

  it('o critério geral de uma definição é célula própria: faltar nele deixa só aquela definição incompleta', () => {
    const answers = allAnswers.filter(
      (a) => !(a.definitionId === 'd2' && a.criterionId === 'g1'),
    )
    expect(definitionsIncomplete(cells, answers)).toEqual([transacional])
    expect(isComplete(cells, answers)).toBe(false)
  })

  it('cada definição aparece uma vez só, mesmo com várias células sem nota', () => {
    const answers = [answer('d2', 'c2'), answer('d2', 'g1')]
    expect(definitionsIncomplete(cells, answers)).toEqual([informacional])
  })

  it('nota fora da escala não conta como nota dada', () => {
    const answers = allAnswers.map((a) =>
      a.definitionId === 'd1' && a.criterionId === 'c1' ? { ...a, value: 'altíssimo' } : a,
    )
    expect(definitionsIncomplete(cells, answers)).toEqual([informacional])
  })

  it('a justificativa sozinha não substitui a nota', () => {
    const answers = cells.map((cell) =>
      answer(cell.definition?.id ?? null, cell.criterion.id, '', 'justifiquei mas não dei nota'),
    )
    expect(isComplete(cells, answers)).toBe(false)
  })

  it('a mensagem nomeia a definição no singular', () => {
    expect(incompleteMessage(['Informacional'])).toBe(
      'A definição “Informacional” ainda tem critério sem nota. Dê uma nota em cada critério dela para enviar a avaliação.',
    )
  })

  it('a mensagem lista as definições no plural', () => {
    expect(incompleteMessage(['Informacional', 'Transacional', 'Navegacional'])).toBe(
      'As definições “Informacional”, “Transacional” e “Navegacional” ainda têm critério sem nota. Dê uma nota em cada critério delas para enviar a avaliação.',
    )
  })

  it('sem definição incompleta, não há mensagem', () => {
    expect(incompleteMessage([])).toBe('')
  })
})

describe('app/projects/[id]/evaluate/completeness — a célula do critério por resposta', () => {
  const aderencia: Criterion = { id: 'g1', definitionId: null, scope: 'general', name: 'Aderência' }
  const diversity: Criterion = {
    id: 'p1',
    definitionId: null,
    scope: 'per_response',
    name: 'Diversity',
  }
  const perResponseCells = resolveCells(definitions, [aderencia, diversity])
  const fullAnswers = perResponseCells.map((cell) =>
    answer(cell.definition?.id ?? null, cell.criterion.id),
  )
  const withoutPerResponse = fullAnswers.filter((a) => a.definitionId !== null)

  it('a chave da célula por resposta usa o marcador, e não o nulo', () => {
    expect(cellKey({ definitionId: null, criterionId: 'p1' })).toBe('per_response_p1')
  })

  it('sem a nota por resposta, a avaliação não está completa', () => {
    expect(isComplete(perResponseCells, withoutPerResponse)).toBe(false)
  })

  it('sem a nota por resposta, nenhuma definição fica incompleta', () => {
    expect(definitionsIncomplete(perResponseCells, withoutPerResponse)).toEqual([])
  })

  it('sem a nota por resposta, o critério por resposta fica incompleto', () => {
    expect(perResponseIncomplete(perResponseCells, withoutPerResponse)).toEqual([diversity])
  })

  it('com todas as notas, a avaliação está completa e nada fica incompleto', () => {
    expect(isComplete(perResponseCells, fullAnswers)).toBe(true)
    expect(definitionsIncomplete(perResponseCells, fullAnswers)).toEqual([])
    expect(perResponseIncomplete(perResponseCells, fullAnswers)).toEqual([])
  })

  it('nota fora da escala na célula por resposta não conta como nota dada', () => {
    const answers = fullAnswers.map((a) =>
      a.definitionId === null ? { ...a, value: 'altíssimo' } : a,
    )

    expect(isComplete(perResponseCells, answers)).toBe(false)
    expect(perResponseIncomplete(perResponseCells, answers)).toEqual([diversity])
  })

  it('a mensagem nomeia o critério por resposta no singular', () => {
    expect(incompleteMessage([], ['Diversity'])).toBe(
      'O critério por resposta “Diversity” ainda está sem nota. Dê uma nota nele para enviar a avaliação.',
    )
  })

  it('a mensagem lista os critérios por resposta no plural', () => {
    expect(incompleteMessage([], ['Diversity', 'Cobertura'])).toBe(
      'Os critérios por resposta “Diversity” e “Cobertura” ainda estão sem nota. Dê uma nota em cada um para enviar a avaliação.',
    )
  })

  it('faltando nos dois, a mensagem junta a definição e o critério por resposta', () => {
    expect(incompleteMessage(['Query 1'], ['Diversity'])).toBe(
      'A definição “Query 1” ainda tem critério sem nota, e o critério por resposta “Diversity” também. Dê uma nota em cada critério para enviar a avaliação.',
    )
  })

  it('faltando nos dois, no plural', () => {
    expect(incompleteMessage(['Query 1', 'Query 2'], ['Diversity', 'Cobertura'])).toBe(
      'As definições “Query 1” e “Query 2” ainda têm critério sem nota, e os critérios por resposta “Diversity” e “Cobertura” também. Dê uma nota em cada critério para enviar a avaliação.',
    )
  })

  it('sem critério por resposta faltando, a mensagem das definições não muda', () => {
    expect(incompleteMessage(['Informacional'], [])).toBe(incompleteMessage(['Informacional']))
    expect(incompleteMessage(['Informacional', 'Transacional'], [])).toBe(
      incompleteMessage(['Informacional', 'Transacional']),
    )
    expect(incompleteMessage([], [])).toBe('')
  })
})
