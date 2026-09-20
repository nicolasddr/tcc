import { describe, it, expect } from 'vitest'
import {
  loadResponseConsensus,
  loadRoundConsensus,
} from '@/app/projects/[id]/(tabs)/rounds/consensus'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { pgErrorCode, type Transaction, consensusNotes } from '@/lib/db'
import {
  inRollbackTx,
  createUser,
  createProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  addEvaluation,
  addConsensusNote,
  memberId,
  type DefinitionFixture,
} from '@/test/helpers'

type Cell = { definitionId: string; criterionId: string }

const DUAS_CELULAS: DefinitionFixture[] = [
  {
    title: 'Navegacional',
    type: 'category',
    criteria: [{ name: 'Clareza' }, { name: 'Completude' }],
  },
]

type Scenario = {
  admin: string
  adminMember: string
  project: string
  round: string
  response: string
  evaluator: string
  cells: Cell[]
}

async function cellsOf(
  tx: Transaction,
  project: string,
  codebookVersion: string,
): Promise<Cell[]> {
  const codebook = await loadCodebookVersion(project, codebookVersion, tx)
  return resolveCells(codebook!.definitions, codebook!.criteria).map((cell) => ({
    definitionId: cell.definition.id,
    criterionId: cell.criterion.id,
  }))
}

async function scenario(tx: Transaction): Promise<Scenario> {
  const admin = await createUser(tx, 'Admin')
  const project = await createProject(tx, admin)
  const adminMember = await memberId(tx, project, admin)
  const evaluator = await addActiveEvaluator(tx, project, await createUser(tx, 'Ana'))

  const codebookVersion = await addCodebookVersion(tx, project, admin, {
    definitions: DUAS_CELULAS,
  })
  const prompt = await addPromptVersion(tx, project, admin)
  const item = await addInputItem(tx, project, admin)
  const round = await addRound(tx, project, admin, codebookVersion, prompt, {
    status: 'closed',
  })
  const response = await addResponse(tx, round, item, admin)
  await addEvaluation(tx, round, response, evaluator)

  return {
    admin,
    adminMember,
    project,
    round,
    response,
    evaluator,
    cells: await cellsOf(tx, project, codebookVersion),
  }
}

async function addSecondRound(
  tx: Transaction,
  s: Scenario,
): Promise<{ round: string; response: string; cells: Cell[] }> {
  const codebookVersion = await addCodebookVersion(tx, s.project, s.admin, {
    versionNumber: 2,
    definitions: DUAS_CELULAS,
  })
  const prompt = await addPromptVersion(tx, s.project, s.admin, { versionNumber: 2 })
  const item = await addInputItem(tx, s.project, s.admin, { name: 'Item 2' })
  const round = await addRound(tx, s.project, s.admin, codebookVersion, prompt, {
    roundNumber: 2,
    status: 'closed',
  })
  const response = await addResponse(tx, round, item, s.admin)
  await addEvaluation(tx, round, response, s.evaluator)

  return { round, response, cells: await cellsOf(tx, s.project, codebookVersion) }
}

async function refused(
  tx: Transaction,
  write: (sp: Transaction) => Promise<unknown>,
): Promise<unknown> {
  return tx.transaction(async (sp) => void (await write(sp))).then(
    () => null,
    (e: unknown) => e,
  )
}

describe('schema da anotação de consenso — consensus_notes', () => {
  it('cn_unique_cell_author: uma anotação por célula por pessoa, e a célula vizinha segue livre', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const [primeira, segunda] = s.cells

      await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...primeira,
        projectMemberId: s.evaluator,
        visibility: 'private',
      })

      const err = await refused(tx, (sp) =>
        addConsensusNote(sp, {
          roundId: s.round,
          responseId: s.response,
          ...primeira,
          projectMemberId: s.evaluator,
          visibility: 'private',
          text: 'Outra anotação',
        }),
      )
      expect(pgErrorCode(err)).toBe('23505')

      await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...primeira,
        projectMemberId: s.adminMember,
        visibility: 'shared',
      })
      await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...segunda,
        projectMemberId: s.evaluator,
        visibility: 'private',
      })

      expect(await loadResponseConsensus(s.response, [s.evaluator], tx)).toHaveLength(3)
    })
  })

  it('cn_text_not_blank e cn_text_len: texto vazio, em branco ou acima do teto é recusado', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)

      for (const text of ['', '   ', 'x'.repeat(5001)]) {
        const err = await refused(tx, (sp) =>
          addConsensusNote(sp, {
            roundId: s.round,
            responseId: s.response,
            ...s.cells[0],
            projectMemberId: s.adminMember,
            visibility: 'shared',
            text,
          }),
        )
        expect(pgErrorCode(err)).toBe('23514')
      }

      expect(await loadResponseConsensus(s.response, [s.adminMember], tx)).toEqual([])
    })
  })

  it('cn_visibility_check: visibilidade fora do vocabulário é recusada', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)

      const err = await refused(tx, (sp) =>
        sp.insert(consensusNotes).values({
          roundId: s.round,
          responseId: s.response,
          ...s.cells[0],
          projectMemberId: s.adminMember,
          visibility: 'secreta',
          text: 'Anotação de teste',
        }),
      )

      expect(pgErrorCode(err)).toBe('23514')
    })
  })

  it('a FK composta torna impossível a anotação apontar para rodada diferente da resposta', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const segunda = await addSecondRound(tx, s)

      const err = await refused(tx, (sp) =>
        addConsensusNote(sp, {
          roundId: segunda.round,
          responseId: s.response,
          ...s.cells[0],
          projectMemberId: s.adminMember,
          visibility: 'shared',
        }),
      )

      expect(pgErrorCode(err)).toBe('23503')
    })
  })

  it('a ata é visível a quem não a escreveu, com o nome do autor', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...s.cells[0],
        projectMemberId: s.adminMember,
        visibility: 'shared',
        text: 'Mantivemos “alta” após a discussão.',
      })

      const vistaPeloAvaliador = await loadResponseConsensus(s.response, [s.evaluator], tx)

      expect(vistaPeloAvaliador).toHaveLength(1)
      expect(vistaPeloAvaliador[0].projectMemberId).toBe(s.adminMember)
      expect(vistaPeloAvaliador[0].authorName).toBe('Admin')
      expect(vistaPeloAvaliador[0].visibility).toBe('shared')
      expect(vistaPeloAvaliador[0].text).toBe('Mantivemos “alta” após a discussão.')
    })
  })

  it('o rascunho privado só aparece para o próprio vínculo', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const bruno = await addActiveEvaluator(tx, s.project, await createUser(tx, 'Bruno'))
      const rascunho = await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...s.cells[0],
        projectMemberId: s.evaluator,
        visibility: 'private',
      })

      expect(await loadResponseConsensus(s.response, [bruno], tx)).toEqual([])
      expect(await loadResponseConsensus(s.response, [s.adminMember], tx)).toEqual([])
      expect(
        (await loadResponseConsensus(s.response, [s.evaluator], tx)).map((n) => n.id),
      ).toEqual([rascunho])
    })
  })

  it('memberIds vazio devolve só a ata — o Administrador sem vínculo de avaliador', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const ata = await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...s.cells[0],
        projectMemberId: s.adminMember,
        visibility: 'shared',
      })
      await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...s.cells[0],
        projectMemberId: s.evaluator,
        visibility: 'private',
      })

      expect((await loadResponseConsensus(s.response, [], tx)).map((n) => n.id)).toEqual([
        ata,
      ])
    })
  })

  it('a ata vem antes do rascunho, e os nomes em ordem alfabética', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const rascunho = await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...s.cells[0],
        projectMemberId: s.evaluator,
        visibility: 'private',
      })
      const ata = await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...s.cells[0],
        projectMemberId: s.adminMember,
        visibility: 'shared',
      })

      expect(
        (await loadResponseConsensus(s.response, [s.evaluator], tx)).map((n) => n.id),
      ).toEqual([ata, rascunho])
    })
  })

  it('loadRoundConsensus recorta por rodada e respeita a visibilidade', async () => {
    await inRollbackTx(async (tx) => {
      const s = await scenario(tx)
      const segunda = await addSecondRound(tx, s)

      const naPrimeira = await addConsensusNote(tx, {
        roundId: s.round,
        responseId: s.response,
        ...s.cells[0],
        projectMemberId: s.adminMember,
        visibility: 'shared',
      })
      const naSegunda = await addConsensusNote(tx, {
        roundId: segunda.round,
        responseId: segunda.response,
        ...segunda.cells[0],
        projectMemberId: s.evaluator,
        visibility: 'private',
      })

      expect((await loadRoundConsensus(s.round, [s.evaluator], tx)).map((n) => n.id)).toEqual(
        [naPrimeira],
      )
      expect(
        (await loadRoundConsensus(segunda.round, [s.evaluator], tx)).map((n) => n.id),
      ).toEqual([naSegunda])
      expect(await loadRoundConsensus(segunda.round, [s.adminMember], tx)).toEqual([])
    })
  })
})
