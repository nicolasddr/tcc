import { describe, it, expect } from 'vitest'
import {
  listEvaluatorEffort,
  loadProjectObservations,
  loadRoundObservations,
  type RoundObservation,
} from '@/app/projects/[id]/(tabs)/rounds/agreement'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { ordinalAlpha } from '@/lib/agreement'
import { type Transaction } from '@/lib/db'
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
  type CellFixture,
  type DefinitionFixture,
} from '@/test/helpers'

type Cell = { definitionId: string; criterionId: string }

const ONE_CELL: DefinitionFixture[] = [
  { title: 'Navegacional', type: 'category', criteria: [{ name: 'Clareza' }] },
]

async function seedProject(tx: Transaction) {
  const admin = await createUser(tx, 'Admin')
  const project = await createProject(tx, admin)
  return { admin, project }
}

async function seedRound(
  tx: Transaction,
  project: string,
  admin: string,
  opts: {
    roundNumber?: number
    definitions?: DefinitionFixture[]
    generalCriteria?: { name: string }[]
    responses?: number
  } = {},
) {
  const versionNumber = opts.roundNumber ?? 1
  const codebookVersion = await addCodebookVersion(tx, project, admin, {
    versionNumber,
    definitions: opts.definitions ?? ONE_CELL,
    generalCriteria: opts.generalCriteria,
  })
  const promptVersion = await addPromptVersion(tx, project, admin, { versionNumber })
  const round = await addRound(tx, project, admin, codebookVersion, promptVersion, {
    roundNumber: versionNumber,
    status: versionNumber === 1 ? 'open' : 'closed',
  })

  const responses: string[] = []
  for (let index = 0; index < (opts.responses ?? 1); index++) {
    const item = await addInputItem(tx, project, admin, {
      name: `Item ${versionNumber}.${index}`,
    })
    responses.push(await addResponse(tx, round, item, admin))
  }

  const codebook = await loadCodebookVersion(project, codebookVersion, tx)
  const cells: Cell[] = resolveCells(codebook!.definitions, codebook!.criteria).map(
    (cell) => ({ definitionId: cell.definition.id, criterionId: cell.criterion.id }),
  )

  return { round, codebookVersion, responses, cells }
}

async function newEvaluator(
  tx: Transaction,
  project: string,
  name: string,
): Promise<string> {
  const user = await createUser(tx, name)
  return addActiveEvaluator(tx, project, user)
}

function filled(cells: Cell[], value: CellFixture['value']): CellFixture[] {
  return cells.map((cell) => ({ ...cell, value }))
}

function unitsOf(observations: RoundObservation[]): string[] {
  return [...new Set(observations.map((observation) => observation.unitId))].sort()
}

describe('app/projects/[id]/rounds/agreement — das notas gravadas para a matriz', () => {
  it('recorta por rodada: as observações de uma não vazam para a outra', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project } = await seedProject(tx)
      const first = await seedRound(tx, project, admin, { roundNumber: 1 })
      const second = await seedRound(tx, project, admin, { roundNumber: 2 })
      const evaluator = await newEvaluator(tx, project, 'Avaliadora')

      await addEvaluation(tx, first.round, first.responses[0], evaluator, {
        cells: filled(first.cells, 'high'),
      })
      await addEvaluation(tx, second.round, second.responses[0], evaluator, {
        cells: filled(second.cells, 'low'),
      })

      const firstObservations = await loadRoundObservations(first.round, tx)
      const secondObservations = await loadRoundObservations(second.round, tx)

      expect(firstObservations).toHaveLength(1)
      expect(firstObservations[0].responseId).toBe(first.responses[0])
      expect(firstObservations[0].value).toBe(3)

      expect(secondObservations).toHaveLength(1)
      expect(secondObservations[0].responseId).toBe(second.responses[0])
      expect(secondObservations[0].value).toBe(1)
    })
  })

  it('a unidade é resposta × célula: o mesmo critério geral em definições diferentes dá unidades diferentes', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project } = await seedProject(tx)
      const scene = await seedRound(tx, project, admin, {
        definitions: [
          { title: 'Navegacional', type: 'category' },
          { title: 'Informacional', type: 'category' },
        ],
        generalCriteria: [{ name: 'Fidelidade' }],
      })
      const evaluator = await newEvaluator(tx, project, 'Avaliadora')

      await addEvaluation(tx, scene.round, scene.responses[0], evaluator, {
        cells: filled(scene.cells, 'medium'),
      })

      const observations = await loadRoundObservations(scene.round, tx)

      expect(observations).toHaveLength(2)
      expect(unitsOf(observations)).toHaveLength(2)
      expect(new Set(observations.map((o) => o.criterionId)).size).toBe(1)
      expect(new Set(observations.map((o) => o.definitionId)).size).toBe(2)
      expect(new Set(observations.map((o) => o.responseId)).size).toBe(1)
    })
  })

  it('avaliação parcial vira dado faltante: as respostas não avaliadas somem, sem nenhum null', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project } = await seedProject(tx)
      const scene = await seedRound(tx, project, admin, { responses: 5 })
      const evaluator = await newEvaluator(tx, project, 'Avaliadora')

      for (const response of scene.responses.slice(0, 2)) {
        await addEvaluation(tx, scene.round, response, evaluator, {
          cells: filled(scene.cells, 'high'),
        })
      }

      const observations = await loadRoundObservations(scene.round, tx)

      expect(observations).toHaveLength(2)
      expect(observations.map((o) => o.responseId).sort()).toEqual(
        scene.responses.slice(0, 2).sort(),
      )
      for (const response of scene.responses.slice(2)) {
        expect(observations.some((o) => o.responseId === response)).toBe(false)
      }
      for (const observation of observations) {
        expect(Object.values(observation).every((field) => field !== null)).toBe(true)
      }
    })
  })

  it('traduz a escala para posto: baixo vira 1, médio 2 e alto 3', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project } = await seedProject(tx)
      const scene = await seedRound(tx, project, admin, { responses: 3 })
      const evaluator = await newEvaluator(tx, project, 'Avaliadora')

      const values = ['low', 'medium', 'high'] as const
      for (const [index, value] of values.entries()) {
        await addEvaluation(tx, scene.round, scene.responses[index], evaluator, {
          cells: filled(scene.cells, value),
        })
      }

      const observations = await loadRoundObservations(scene.round, tx)
      const byResponse = new Map(observations.map((o) => [o.responseId, o.value]))

      expect(byResponse.get(scene.responses[0])).toBe(1)
      expect(byResponse.get(scene.responses[1])).toBe(2)
      expect(byResponse.get(scene.responses[2])).toBe(3)
    })
  })

  it('loadProjectObservations agrupa por rodada e omite a rodada sem nenhuma avaliação', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project } = await seedProject(tx)
      const avaliada = await seedRound(tx, project, admin, { roundNumber: 1 })
      const vazia = await seedRound(tx, project, admin, { roundNumber: 2 })
      const evaluator = await newEvaluator(tx, project, 'Avaliadora')

      await addEvaluation(tx, avaliada.round, avaliada.responses[0], evaluator, {
        cells: filled(avaliada.cells, 'high'),
      })

      const byRound = await loadProjectObservations(project, tx)

      expect([...byRound.keys()]).toEqual([avaliada.round])
      expect(byRound.get(avaliada.round)).toHaveLength(1)
      expect(byRound.has(vazia.round)).toBe(false)
    })
  })

  it('loadProjectObservations não traz as observações de outro projeto', async () => {
    await inRollbackTx(async (tx) => {
      const mine = await seedProject(tx)
      const theirs = await seedProject(tx)
      const scene = await seedRound(tx, theirs.project, theirs.admin)
      const evaluator = await newEvaluator(tx, theirs.project, 'De outro projeto')

      await addEvaluation(tx, scene.round, scene.responses[0], evaluator, {
        cells: filled(scene.cells, 'high'),
      })

      expect([...(await loadProjectObservations(mine.project, tx)).keys()]).toEqual([])
    })
  })

  it('listEvaluatorEffort conta as avaliações enviadas na rodada e mostra quem enviou zero', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project } = await seedProject(tx)
      const scene = await seedRound(tx, project, admin, { responses: 3 })
      const ativa = await newEvaluator(tx, project, 'Ana')
      const parada = await newEvaluator(tx, project, 'Bruno')

      for (const response of scene.responses) {
        await addEvaluation(tx, scene.round, response, ativa, {
          cells: filled(scene.cells, 'high'),
        })
      }

      const effort = await listEvaluatorEffort(scene.round, project, tx)

      expect(effort).toEqual([
        { projectMemberId: ativa, name: 'Ana', submitted: 3 },
        { projectMemberId: parada, name: 'Bruno', submitted: 0 },
      ])
    })
  })

  it('listEvaluatorEffort ignora o avaliador de outro projeto e a avaliação de outra rodada', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project } = await seedProject(tx)
      const first = await seedRound(tx, project, admin, { roundNumber: 1 })
      const second = await seedRound(tx, project, admin, { roundNumber: 2 })
      const evaluator = await newEvaluator(tx, project, 'Ana')

      const other = await seedProject(tx)
      await newEvaluator(tx, other.project, 'De outro projeto')

      await addEvaluation(tx, second.round, second.responses[0], evaluator, {
        cells: filled(second.cells, 'high'),
      })

      expect(await listEvaluatorEffort(first.round, project, tx)).toEqual([
        { projectMemberId: evaluator, name: 'Ana', submitted: 0 },
      ])
      expect(await listEvaluatorEffort(second.round, project, tx)).toEqual([
        { projectMemberId: evaluator, name: 'Ana', submitted: 1 },
      ])
    })
  })

  it('compõe com o módulo puro: concordância perfeita com variação no banco dá alpha 1', async () => {
    await inRollbackTx(async (tx) => {
      const { admin, project } = await seedProject(tx)
      const scene = await seedRound(tx, project, admin, { responses: 3 })
      const ana = await newEvaluator(tx, project, 'Ana')
      const bruno = await newEvaluator(tx, project, 'Bruno')

      const values = ['low', 'medium', 'high'] as const
      for (const [index, value] of values.entries()) {
        for (const evaluator of [ana, bruno]) {
          await addEvaluation(tx, scene.round, scene.responses[index], evaluator, {
            cells: filled(scene.cells, value),
          })
        }
      }

      const agreement = ordinalAlpha(await loadRoundObservations(scene.round, tx))

      expect(agreement).toEqual({ calculable: true, alpha: 1, units: 3, raters: 2 })
    })
  })
})
