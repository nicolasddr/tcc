import { describe, it, expect } from 'vitest'
import { consensusByCell } from '@/app/projects/[id]/(tabs)/rounds/consensus-cells'
import type { ConsensusNote } from '@/app/projects/[id]/(tabs)/rounds/consensus'

function note(
  id: string,
  definitionId: string,
  criterionId: string,
  projectMemberId: string,
  visibility: ConsensusNote['visibility'],
  authorName = projectMemberId.toUpperCase(),
): ConsensusNote {
  return {
    id,
    responseId: 'r1',
    definitionId,
    criterionId,
    projectMemberId,
    authorName,
    visibility,
    text: `texto de ${id}`,
    updatedAt: '2026-09-20T12:00:00Z',
  }
}

describe('consensusByCell', () => {
  it('agrupa por célula e não inventa célula sem anotação', () => {
    const byCell = consensusByCell(
      [
        note('n1', 'd1', 'c1', 'm1', 'shared'),
        note('n2', 'd1', 'c2', 'm1', 'shared'),
      ],
      null,
    )

    expect([...byCell.keys()]).toEqual(['d1:c1', 'd1:c2'])
    expect(byCell.get('d1:c1')!.minutes.map((n) => n.id)).toEqual(['n1'])
    expect(byCell.get('d2:c1')).toBeUndefined()
  })

  it('o rascunho privado não entra na ata, mas é `mine` do próprio vínculo', () => {
    const notes = [
      note('ata', 'd1', 'c1', 'admin', 'shared'),
      note('rascunho', 'd1', 'c1', 'ana', 'private'),
    ]

    const paraAna = consensusByCell(notes, 'ana')
    expect(paraAna.get('d1:c1')!.minutes.map((n) => n.id)).toEqual(['ata'])
    expect(paraAna.get('d1:c1')!.mine!.id).toBe('rascunho')
  })

  it('`mine` é null quando não há vínculo de escrita, e quando o vínculo não anotou', () => {
    const notes = [note('rascunho', 'd1', 'c1', 'ana', 'private')]

    expect(consensusByCell(notes, null).get('d1:c1')!.mine).toBeNull()
    expect(consensusByCell(notes, 'bruno').get('d1:c1')!.mine).toBeNull()
  })

  it('a ata do próprio Administrador aparece nos dois campos', () => {
    const byCell = consensusByCell([note('ata', 'd1', 'c1', 'admin', 'shared')], 'admin')

    expect(byCell.get('d1:c1')!.minutes.map((n) => n.id)).toEqual(['ata'])
    expect(byCell.get('d1:c1')!.mine!.id).toBe('ata')
  })

  it('duas atas na mesma célula convivem, em ordem de nome', () => {
    const byCell = consensusByCell(
      [
        note('b', 'd1', 'c1', 'm2', 'shared', 'Beatriz'),
        note('a', 'd1', 'c1', 'm1', 'shared', 'Ana'),
      ],
      null,
    )

    expect(byCell.get('d1:c1')!.minutes.map((n) => n.id)).toEqual(['a', 'b'])
  })
})
