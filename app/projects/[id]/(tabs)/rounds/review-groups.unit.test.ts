import { describe, it, expect } from 'vitest'
import type { Scope } from '@/app/projects/[id]/pipeline/criteria'
import {
  divergentCells,
  ratedCells,
  reviewGroups,
  type CellNote,
  type ReviewCell,
  type ReviewGroup,
} from '@/app/projects/[id]/(tabs)/rounds/review-groups'
import type { ScaleValue } from '@/app/projects/[id]/(tabs)/evaluate/scale'

type Definition = { id: string; title: string }
type Criterion = { id: string; definitionId: string | null; scope: Scope; name: string }

const informacional: Definition = { id: 'd1', title: 'Informacional' }
const transacional: Definition = { id: 'd2', title: 'Transacional' }

function criterion(id: string, definitionId: string | null): Criterion {
  return { id, definitionId, scope: definitionId === null ? 'general' : 'specific', name: id }
}

function perResponse(id: string): Criterion {
  return { id, definitionId: null, scope: 'per_response', name: id }
}

function note(
  definitionId: string | null,
  criterionId: string,
  projectMemberId: string,
  value: ScaleValue,
  justification: string | null = null,
): CellNote {
  return {
    definitionId,
    criterionId,
    projectMemberId,
    evaluatorName: projectMemberId.toUpperCase(),
    value,
    justification,
    isOutlier: false,
    outlierReason: null,
  }
}

function cellOf(
  group: ReviewGroup<Definition, Criterion> | undefined,
  criterionId: string,
): ReviewCell<Criterion> {
  const found = group?.cells.find((cell) => cell.criterion.id === criterionId)
  if (!found) throw new Error(`critério ${criterionId} não está no grupo`)
  return found
}

describe('app/projects/[id]/rounds/review-groups — a revisão de uma resposta', () => {
  it('um grupo por definição, na ordem recebida, com os específicos antes dos gerais', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const groups = reviewGroups([informacional, transacional], criteria, [])

    expect(groups.map((group) => group.definition?.id)).toEqual(['d1', 'd2'])
    expect(groups[0].cells.map((cell) => cell.criterion.id)).toEqual(['c1', 'g1'])
    expect(groups[0].cells.map((cell) => cell.isGeneral)).toEqual([false, true])
    expect(groups[1].cells.map((cell) => cell.criterion.id)).toEqual(['g1'])
  })

  it('célula sem nota fica sem nota, e não vira unanimidade', () => {
    const [group] = reviewGroups([informacional], [criterion('g1', null)], [])

    expect(cellOf(group, 'g1').divergence).toBe('unrated')
    expect(cellOf(group, 'g1').notes).toEqual([])
    expect(group.divergent).toBe(0)
  })

  it('o mesmo critério geral rende uma célula por definição, com divergências próprias', () => {
    const criteria = [criterion('g1', null)]

    const [informacionalGroup, transacionalGroup] = reviewGroups(
      [informacional, transacional],
      criteria,
      [
        note('d1', 'g1', 'ana', 'high'),
        note('d1', 'g1', 'bruno', 'high'),
        note('d2', 'g1', 'ana', 'high'),
        note('d2', 'g1', 'bruno', 'low'),
      ],
    )

    expect(cellOf(informacionalGroup, 'g1').divergence).toBe('unanimous')
    expect(cellOf(transacionalGroup, 'g1').divergence).toBe('extreme')
    expect(informacionalGroup.divergent).toBe(0)
    expect(transacionalGroup.divergent).toBe(1)
  })

  it('critério específico de uma definição não aparece na outra', () => {
    const criteria = [criterion('c1', 'd1')]

    const [informacionalGroup, transacionalGroup] = reviewGroups(
      [informacional, transacional],
      criteria,
      [note('d1', 'c1', 'ana', 'medium')],
    )

    expect(cellOf(informacionalGroup, 'c1').notes).toHaveLength(1)
    expect(transacionalGroup.cells).toEqual([])
  })

  it('nota de outra célula não contamina a vizinha', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const [group] = reviewGroups(
      [informacional],
      criteria,
      [
        note('d1', 'g1', 'ana', 'high'),
        note('d1', 'g1', 'bruno', 'high'),
        note('d1', 'c1', 'ana', 'high'),
        note('d1', 'c1', 'bruno', 'low'),
      ],
    )

    expect(cellOf(group, 'g1').divergence).toBe('unanimous')
    expect(cellOf(group, 'c1').divergence).toBe('extreme')
    expect(cellOf(group, 'g1').notes.map((entry) => entry.value)).toEqual([
      'high',
      'high',
    ])
  })

  it('nota de uma célula que não existe no codebook da rodada é ignorada', () => {
    const [group] = reviewGroups(
      [informacional],
      [criterion('g1', null)],
      [note('d1', 'fantasma', 'ana', 'low')],
    )

    expect(group.cells).toHaveLength(1)
    expect(cellOf(group, 'g1').divergence).toBe('unrated')
  })

  it('uma nota só é single: nem unanimidade nem divergência no resumo do grupo', () => {
    const [group] = reviewGroups(
      [informacional],
      [criterion('g1', null)],
      [note('d1', 'g1', 'ana', 'medium')],
    )

    expect(cellOf(group, 'g1').divergence).toBe('single')
    expect(group.divergent).toBe(0)
  })

  it('as notas saem ordenadas por nome do avaliador, com o vínculo como desempate', () => {
    const repeated = (projectMemberId: string, value: ScaleValue): CellNote => ({
      ...note('d1', 'g1', projectMemberId, value),
      evaluatorName: 'Ana Souza',
    })

    const [group] = reviewGroups(
      [informacional],
      [criterion('g1', null)],
      [
        note('d1', 'g1', 'zoe', 'high'),
        repeated('m2', 'low'),
        repeated('m1', 'medium'),
      ],
    )

    expect(cellOf(group, 'g1').notes.map((entry) => entry.projectMemberId)).toEqual([
      'm1',
      'm2',
      'zoe',
    ])
  })

  it('a justificativa viaja junto da nota, e ausente é nulo, não string vazia', () => {
    const [group] = reviewGroups(
      [informacional],
      [criterion('g1', null)],
      [
        note('d1', 'g1', 'ana', 'high', 'o texto responde direto à pergunta'),
        note('d1', 'g1', 'bruno', 'low'),
      ],
    )

    expect(cellOf(group, 'g1').notes).toEqual([
      {
        projectMemberId: 'ana',
        evaluatorName: 'ANA',
        value: 'high',
        justification: 'o texto responde direto à pergunta',
        isOutlier: false,
        outlierReason: null,
      },
      {
        projectMemberId: 'bruno',
        evaluatorName: 'BRUNO',
        value: 'low',
        justification: null,
        isOutlier: false,
        outlierReason: null,
      },
    ])
  })

  it('divergentCells conta célula, e não nota', () => {
    const criteria = [criterion('g1', null), criterion('c1', 'd1')]

    const groups = reviewGroups(
      [informacional],
      criteria,
      [
        note('d1', 'g1', 'ana', 'high'),
        note('d1', 'g1', 'bruno', 'low'),
        note('d1', 'g1', 'clara', 'medium'),
        note('d1', 'c1', 'ana', 'high'),
        note('d1', 'c1', 'bruno', 'medium'),
      ],
    )

    expect(divergentCells(groups)).toBe(2)
  })

  it('divergentCells soma os grupos, e ratedCells conta célula com alguma nota', () => {
    const criteria = [criterion('g1', null)]

    const groups = reviewGroups(
      [informacional, transacional],
      criteria,
      [
        note('d1', 'g1', 'ana', 'high'),
        note('d1', 'g1', 'bruno', 'low'),
        note('d2', 'g1', 'ana', 'medium'),
      ],
    )

    expect(divergentCells(groups)).toBe(1)
    expect(ratedCells(groups)).toBe(2)
  })

  it('sem nota nenhuma, nada é divergente e nada foi avaliado', () => {
    const groups = reviewGroups(
      [informacional, transacional],
      [criterion('g1', null)],
      [],
    )

    expect(divergentCells(groups)).toBe(0)
    expect(ratedCells(groups)).toBe(0)
  })
})

describe('app/projects/[id]/rounds/review-groups — o grupo por resposta', () => {
  const criteria = [criterion('g1', null), perResponse('p1'), perResponse('p2')]

  function perResponseGroup(
    groups: ReviewGroup<Definition, Criterion>[],
  ): ReviewGroup<Definition, Criterion> | undefined {
    return groups.find((group) => group.definition === null)
  }

  it('o grupo por resposta vem por último, sem definição, com uma célula por critério por resposta', () => {
    const groups = reviewGroups([informacional, transacional], criteria, [])

    expect(groups.map((group) => group.definition?.id ?? null)).toEqual(['d1', 'd2', null])
    expect(groups[2].cells.map((cell) => cell.criterion.id)).toEqual(['p1', 'p2'])
    expect(groups[2].cells.map((cell) => cell.isGeneral)).toEqual([false, false])
    expect(groups[0].cells.map((cell) => cell.criterion.id)).toEqual(['g1'])
  })

  it('a divergência da célula por resposta é calculada como nas outras, e entra nas contagens', () => {
    const groups = reviewGroups([informacional], criteria, [
      note('d1', 'g1', 'ana', 'high'),
      note('d1', 'g1', 'bruno', 'high'),
      note(null, 'p1', 'ana', 'high'),
      note(null, 'p1', 'bruno', 'low'),
      note(null, 'p2', 'ana', 'medium'),
    ])
    const group = perResponseGroup(groups)

    expect(cellOf(group, 'p1').divergence).toBe('extreme')
    expect(cellOf(group, 'p2').divergence).toBe('single')
    expect(group?.divergent).toBe(1)
    expect(divergentCells(groups)).toBe(1)
    expect(ratedCells(groups)).toBe(3)
  })

  it('a divergência adjacente também vale na célula por resposta', () => {
    const groups = reviewGroups([informacional], criteria, [
      note(null, 'p2', 'ana', 'high'),
      note(null, 'p2', 'bruno', 'medium'),
    ])

    expect(cellOf(perResponseGroup(groups), 'p2').divergence).toBe('adjacent')
    expect(divergentCells(groups)).toBe(1)
  })

  it('a nota por resposta não vaza para o grupo de uma definição, e a de definição não vaza para ele', () => {
    const groups = reviewGroups([informacional], [criterion('g1', null), perResponse('p1')], [
      note(null, 'p1', 'ana', 'low'),
      note('d1', 'p1', 'bruno', 'high'),
      note(null, 'g1', 'ana', 'high'),
    ])

    expect(groups[0].cells.map((cell) => cell.criterion.id)).toEqual(['g1'])
    expect(cellOf(groups[0], 'g1').divergence).toBe('unrated')
    expect(cellOf(perResponseGroup(groups), 'p1').notes.map((entry) => entry.value)).toEqual([
      'low',
    ])
  })

  it('a nota sem definição num critério geral não cai em célula nenhuma', () => {
    const groups = reviewGroups([informacional], criteria, [
      note(null, 'g1', 'ana', 'high'),
      note(null, 'g1', 'bruno', 'low'),
    ])

    expect(ratedCells(groups)).toBe(0)
    expect(divergentCells(groups)).toBe(0)
  })

  it('sem critério por resposta não há grupo sem definição', () => {
    const groups = reviewGroups([informacional], [criterion('g1', null)], [
      note(null, 'g1', 'ana', 'high'),
    ])

    expect(groups.map((group) => group.definition?.id ?? null)).toEqual(['d1'])
  })
})
