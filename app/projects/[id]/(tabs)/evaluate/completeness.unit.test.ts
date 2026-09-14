import { describe, it, expect } from 'vitest'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import {
  cellKey,
  definitionsIncomplete,
  incompleteMessage,
  isComplete,
  type Answer,
} from '@/app/projects/[id]/(tabs)/evaluate/completeness'

type Definition = { id: string; title: string }
type Criterion = { id: string; definitionId: string | null; name: string }

const informacional: Definition = { id: 'd1', title: 'Informacional' }
const transacional: Definition = { id: 'd2', title: 'Transacional' }

const definitions = [informacional, transacional]

const criteria: Criterion[] = [
  { id: 'c1', definitionId: 'd1', name: 'Clareza' },
  { id: 'c2', definitionId: 'd2', name: 'Precisão' },
  { id: 'g1', definitionId: null, name: 'Aderência' },
]

const cells = resolveCells(definitions, criteria)

function answer(
  definitionId: string,
  criterionId: string,
  value = 'high',
  justification = '',
): Answer {
  return { definitionId, criterionId, value, justification }
}

const allAnswers = cells.map((cell) => answer(cell.definition.id, cell.criterion.id))

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
      answer(cell.definition.id, cell.criterion.id, '', 'justifiquei mas não dei nota'),
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
