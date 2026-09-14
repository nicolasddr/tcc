import { describe, it, expect } from 'vitest'
import {
  listRoundResponses,
  loadItemRoundUsage,
  loadItemsUsedInRound,
  loadRoundComposition,
} from '@/app/projects/[id]/pipeline/responses'
import { type Transaction } from '@/lib/db'
import {
  inRollbackTx,
  createUser,
  createProject,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
} from '@/test/helpers'

const DEFINITIONS = [
  { title: 'Navegacional', type: 'category', criteria: [{ name: 'Clareza' }] },
  { title: 'Informacional', type: 'category', criteria: [{ name: 'Precisão' }] },
  { title: 'Transacional', type: 'category', criteria: [{ name: 'Escopo' }] },
]

async function seedRound(
  tx: Transaction,
  opts: { promptText?: string; status?: 'open' | 'closed'; roundNumber?: number } = {},
) {
  const admin = await createUser(tx, 'Admin')
  const project = await createProject(tx, admin)
  const codebookVersion = await addCodebookVersion(tx, project, admin, {
    definitions: DEFINITIONS,
  })
  const promptVersion = await addPromptVersion(tx, project, admin, {
    text: opts.promptText ?? 'Classifique a consulta de busca abaixo.',
  })
  const round = await addRound(tx, project, admin, codebookVersion, promptVersion, {
    roundNumber: opts.roundNumber ?? 1,
    status: opts.status ?? 'open',
  })
  return { admin, project, codebookVersion, promptVersion, round }
}

describe('app/projects/[id]/pipeline/responses — a leitura que alimenta a geração', () => {
  it('loadRoundComposition devolve o texto do prompt e os títulos na ordem salva', async () => {
    await inRollbackTx(async (tx) => {
      const { project, round, codebookVersion, promptVersion } = await seedRound(tx, {
        promptText: 'Prompt da rodada',
      })

      const composition = await loadRoundComposition(project, round, tx)

      expect(composition).toEqual({
        promptVersionId: promptVersion,
        codebookVersionId: codebookVersion,
        promptText: 'Prompt da rodada',
        definitionTitles: ['Navegacional', 'Informacional', 'Transacional'],
      })
    })
  })

  it('loadRoundComposition lê as versões FIXADAS pela rodada, não as vigentes', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project, round, codebookVersion, promptVersion } =
        await seedRound(tx, { promptText: 'Prompt da versão 1' })

      await addCodebookVersion(tx, project, admin, {
        versionNumber: 2,
        definitions: [
          { title: 'Depois da rodada', type: 'category', criteria: [{ name: 'X' }] },
        ],
      })
      await addPromptVersion(tx, project, admin, {
        versionNumber: 2,
        text: 'Prompt da versão 2',
      })

      const composition = await loadRoundComposition(project, round, tx)

      expect(composition?.promptText).toBe('Prompt da versão 1')
      expect(composition?.definitionTitles).toEqual([
        'Navegacional',
        'Informacional',
        'Transacional',
      ])
      expect(composition?.promptVersionId).toBe(promptVersion)
      expect(composition?.codebookVersionId).toBe(codebookVersion)
    })
  })

  it('loadRoundComposition não devolve rodada de outro projeto nem id inválido', async () => {
    await inRollbackTx(async (tx) => {
      const { round } = await seedRound(tx)
      const other = await createUser(tx, 'Outro')
      const otherProject = await createProject(tx, other, 'Outro Projeto')

      expect(await loadRoundComposition(otherProject, round, tx)).toBeNull()
      expect(await loadRoundComposition(otherProject, 'nem-uuid', tx)).toBeNull()
      expect(
        await loadRoundComposition(
          otherProject,
          '00000000-0000-4000-8000-000000000000',
          tx,
        ),
      ).toBeNull()
    })
  })

  it('loadItemRoundUsage diz em quais rodadas cada item já produziu resposta', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project, codebookVersion, promptVersion, round } = await seedRound(
        tx,
        { roundNumber: 1, status: 'closed' },
      )
      const round2 = await addRound(tx, project, admin, codebookVersion, promptVersion, {
        roundNumber: 2,
        status: 'closed',
      })
      const round3 = await addRound(tx, project, admin, codebookVersion, promptVersion, {
        roundNumber: 3,
      })

      const repeated = await addInputItem(tx, project, admin, { name: 'Repetido' })
      const once = await addInputItem(tx, project, admin, { name: 'Uma vez' })
      const unused = await addInputItem(tx, project, admin, { name: 'Nunca usado' })

      await addResponse(tx, round3, repeated, admin)
      await addResponse(tx, round, repeated, admin)
      await addResponse(tx, round2, once, admin)

      const usage = await loadItemRoundUsage(project, tx)

      expect(usage.get(repeated)).toEqual([1, 3])
      expect(usage.get(once)).toEqual([2])
      expect(usage.has(unused)).toBe(false)
    })
  })

  it('loadItemRoundUsage não mistura o uso de outro projeto', async () => {
    await inRollbackTx(async (tx) => {
      const mine = await seedRound(tx)
      const theirs = await seedRound(tx)

      const myItem = await addInputItem(tx, mine.project, mine.admin)
      const theirItem = await addInputItem(tx, theirs.project, theirs.admin)
      await addResponse(tx, mine.round, myItem, mine.admin)
      await addResponse(tx, theirs.round, theirItem, theirs.admin)

      const usage = await loadItemRoundUsage(mine.project, tx)

      expect([...usage.keys()]).toEqual([myItem])
    })
  })

  it('loadItemsUsedInRound lista só os itens já consumidos pela rodada', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project, codebookVersion, promptVersion, round } = await seedRound(
        tx,
        { roundNumber: 1, status: 'closed' },
      )
      const round2 = await addRound(tx, project, admin, codebookVersion, promptVersion, {
        roundNumber: 2,
      })

      const used = await addInputItem(tx, project, admin, { name: 'Usado' })
      const elsewhere = await addInputItem(tx, project, admin, { name: 'Na outra' })
      await addInputItem(tx, project, admin, { name: 'Livre' })

      await addResponse(tx, round, used, admin)
      await addResponse(tx, round2, elsewhere, admin)

      expect(await loadItemsUsedInRound(round, tx)).toEqual([used])
      expect(await loadItemsUsedInRound(round2, tx)).toEqual([elsewhere])
      expect(await loadItemsUsedInRound('nem-uuid', tx)).toEqual([])
    })
  })
})

describe('app/projects/[id]/pipeline/responses — a ordem canônica da rodada', () => {
  it('lista por created_at e, no empate, pelo id — sempre na mesma ordem', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project, round } = await seedRound(tx)

      const created: string[] = []
      for (let index = 0; index < 5; index += 1) {
        const item = await addInputItem(tx, project, admin, { name: `Item ${index + 1}` })
        created.push(await addResponse(tx, round, item, admin))
      }

      const listed = await listRoundResponses(round, tx)

      expect(new Set(listed.map((response) => response.createdAt)).size).toBe(1)
      expect(listed.map((response) => response.id)).toEqual([...created].sort())
      expect(listed.map((response) => response.id)).toEqual(
        (await listRoundResponses(round, tx)).map((response) => response.id),
      )
    })
  })
})
