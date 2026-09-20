// app/projects/[id]/(tabs)/rounds/consensus-actions.int.test.ts — a porta única da
// anotação de consenso (issue #66, Parte 2): quem escreve o quê, onde, e o que apagar
// um texto significa.
//
// As actions abrem a própria transação e COMMITAM, então as fixtures vão por `ownerDb`
// e saem no `cleanup()` — não dá para rodar sob rollback.
//
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`), igual ao `npm test`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', async () => {
  const { supabaseServerMock } = await import('@/test/helpers')
  return supabaseServerMock(auth)
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import { saveConsensusNote } from '@/app/projects/[id]/(tabs)/rounds/consensus-actions'
import { loadResponseConsensus } from '@/app/projects/[id]/(tabs)/rounds/consensus'
import { loadCodebookVersion } from '@/app/projects/[id]/pipeline/codebook'
import { resolveCells } from '@/app/projects/[id]/pipeline/criteria'
import { PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { CONSENSUS_NOTE_MAX } from '@/lib/limits'
import { ownerDb, type DbExecutor, consensusNotes, projectMembers } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addCodebookVersion,
  addPromptVersion,
  addInputItem,
  addRound,
  addResponse,
  addEvaluation,
  memberId,
  cleanup,
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

function saveForm(
  projectId: string,
  roundId: string,
  responseId: string,
  cell: Cell,
  text: string,
): FormData {
  const form = new FormData()
  form.set('project_id', projectId)
  form.set('round_id', roundId)
  form.set('response_id', responseId)
  form.set('definition_id', cell.definitionId)
  form.set('criterion_id', cell.criterionId)
  form.set('text', text)
  return form
}

function notesOf(responseId: string) {
  return ownerDb
    .select({
      id: consensusNotes.id,
      roundId: consensusNotes.roundId,
      definitionId: consensusNotes.definitionId,
      criterionId: consensusNotes.criterionId,
      projectMemberId: consensusNotes.projectMemberId,
      visibility: consensusNotes.visibility,
      text: consensusNotes.text,
      updatedAt: consensusNotes.updatedAt,
    })
    .from(consensusNotes)
    .where(eq(consensusNotes.responseId, responseId))
}

async function cellsOf(
  db: DbExecutor,
  project: string,
  codebookVersion: string,
): Promise<Cell[]> {
  const codebook = await loadCodebookVersion(project, codebookVersion, db)
  return resolveCells(codebook!.definitions, codebook!.criteria).map((cell) => ({
    definitionId: cell.definition.id,
    criterionId: cell.criterion.id,
  }))
}

describe('app/projects/[id]/rounds/consensus-actions — salvar a anotação de consenso', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  type Scenario = {
    admin: string
    adminMember: string
    project: string
    round: string
    response: string
    evaluator: string
    evaluatorUser: string
    cells: Cell[]
  }

  async function scenario(
    opts: { roundNumber?: number; status?: 'open' | 'closed' } = {},
  ): Promise<Scenario> {
    const admin = await newUser('Admin')
    const project = await seedProject(ownerDb, admin, 'Projeto de Teste', {
      phase: PHASE_2,
    })
    projs.push(project)
    const adminMember = await memberId(ownerDb, project, admin)

    const evaluatorUser = await newUser('Ana')
    const evaluator = await addActiveEvaluator(ownerDb, project, evaluatorUser)

    const codebook = await addCodebookVersion(ownerDb, project, admin, {
      definitions: DUAS_CELULAS,
    })
    const prompt = await addPromptVersion(ownerDb, project, admin)
    const item = await addInputItem(ownerDb, project, admin)
    const round = await addRound(ownerDb, project, admin, codebook, prompt, {
      roundNumber: opts.roundNumber ?? 1,
      status: opts.status ?? 'closed',
    })
    const response = await addResponse(ownerDb, round, item, admin)
    await addEvaluation(ownerDb, round, response, evaluator)

    return {
      admin,
      adminMember,
      project,
      round,
      response,
      evaluator,
      evaluatorUser,
      cells: await cellsOf(ownerDb, project, codebook),
    }
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('quem não é membro do projeto é barrado e nada é gravado', async () => {
    const s = await scenario()
    auth.userId = await newUser('De Fora')

    const result = await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Tentativa de fora.'),
    )

    expect(result).toMatchObject({
      error: expect.stringContaining('participa deste projeto'),
    })
    expect(await notesOf(s.response)).toHaveLength(0)
  })

  it('o Administrador grava ata: visibilidade compartilhada, vínculo de administrador e texto com trim', async () => {
    const s = await scenario()
    auth.userId = s.admin

    const result = await saveConsensusNote(
      null,
      saveForm(
        s.project,
        s.round,
        s.response,
        s.cells[0],
        '  Mantivemos “alta”: a divergência era de leitura do critério.  ',
      ),
    )
    expect(result).toMatchObject({ ok: true, saved: true })

    const [ata] = await notesOf(s.response)
    expect(ata.visibility).toBe('shared')
    expect(ata.projectMemberId).toBe(s.adminMember)
    expect(ata.roundId).toBe(s.round)
    expect(ata.text).toBe('Mantivemos “alta”: a divergência era de leitura do critério.')
  })

  it('o Avaliador grava rascunho privado com o próprio vínculo', async () => {
    const s = await scenario()
    auth.userId = s.evaluatorUser

    const result = await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Levar à reunião: fiquei em dúvida.'),
    )
    expect(result).toMatchObject({ ok: true, saved: true })

    const [rascunho] = await notesOf(s.response)
    expect(rascunho.visibility).toBe('private')
    expect(rascunho.projectMemberId).toBe(s.evaluator)
  })

  it('a ata é visível para o avaliador da rodada, e o rascunho de um avaliador não é visível para o outro', async () => {
    const s = await scenario()
    const brunoUser = await newUser('Bruno')
    const bruno = await addActiveEvaluator(ownerDb, s.project, brunoUser)
    await addEvaluation(ownerDb, s.round, s.response, bruno)

    auth.userId = s.admin
    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Decisão da equipe.'),
    )

    auth.userId = s.evaluatorUser
    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Rascunho da Ana.'),
    )

    const paraBruno = await loadResponseConsensus(s.response, [bruno])
    expect(paraBruno.map((note) => note.text)).toEqual(['Decisão da equipe.'])

    const paraAna = await loadResponseConsensus(s.response, [s.evaluator])
    expect(paraAna.map((note) => note.text)).toEqual([
      'Decisão da equipe.',
      'Rascunho da Ana.',
    ])
  })

  it('o Administrador não lê o rascunho de nenhum avaliador', async () => {
    const s = await scenario()
    auth.userId = s.evaluatorUser
    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Só eu vejo isto.'),
    )

    expect(await loadResponseConsensus(s.response, [s.adminMember])).toEqual([])
  })

  it('o Administrador-avaliador escreve ata, e não rascunho', async () => {
    const s = await scenario()
    const evaluatorToo = await addActiveEvaluator(ownerDb, s.project, s.admin)
    await addEvaluation(ownerDb, s.round, s.response, evaluatorToo)

    auth.userId = s.admin
    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Ata de quem tem dois vínculos.'),
    )

    const [nota] = await notesOf(s.response)
    expect(nota.visibility).toBe('shared')
    expect(nota.projectMemberId).toBe(s.adminMember)
  })

  it('a rodada em que o avaliador não avaliou é recusada, mesmo com resposta válida', async () => {
    const s = await scenario()
    const semNotaUser = await newUser('Bruno')
    await addActiveEvaluator(ownerDb, s.project, semNotaUser)

    auth.userId = semNotaUser
    const result = await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Tentativa de quem não avaliou.'),
    )

    expect(result).toMatchObject({
      error: expect.stringContaining('não avaliou nesta rodada'),
    })
    expect(await notesOf(s.response)).toHaveLength(0)
  })

  it('a rodada aberta é recusada para os dois papéis', async () => {
    const s = await scenario({ status: 'open' })

    for (const caller of [s.admin, s.evaluatorUser]) {
      auth.userId = caller
      const result = await saveConsensusNote(
        null,
        saveForm(s.project, s.round, s.response, s.cells[0], 'Cedo demais.'),
      )
      expect(result).toMatchObject({
        error: expect.stringContaining('A revisão abre quando a rodada fecha'),
      })
    }

    expect(await notesOf(s.response)).toHaveLength(0)
  })

  it('resposta de outra rodada e célula fora da versão da rodada são recusadas', async () => {
    const s = await scenario()
    const outro = await scenario()

    auth.userId = s.admin
    const respostaDeOutro = await saveConsensusNote(
      null,
      saveForm(s.project, s.round, outro.response, s.cells[0], 'Resposta alheia.'),
    )
    const celulaDeOutro = await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, outro.cells[0], 'Célula alheia.'),
    )

    expect(respostaDeOutro).toMatchObject({
      error: expect.stringContaining('não pertence a esta rodada'),
    })
    expect(celulaDeOutro).toMatchObject({
      error: expect.stringContaining('versão de codebook'),
    })
    expect(await notesOf(s.response)).toHaveLength(0)
    expect(await notesOf(outro.response)).toHaveLength(0)
  })

  it('a célula tem que existir de verdade: critério de outra definição da mesma versão é recusado', async () => {
    const s = await scenario()
    const codebook = await addCodebookVersion(ownerDb, s.project, s.admin, {
      versionNumber: 2,
      definitions: [
        { title: 'A', type: 'category', criteria: [{ name: 'Clareza' }] },
        { title: 'B', type: 'category', criteria: [{ name: 'Completude' }] },
      ],
    })
    const prompt = await addPromptVersion(ownerDb, s.project, s.admin, { versionNumber: 2 })
    const item = await addInputItem(ownerDb, s.project, s.admin, { name: 'Item 2' })
    const round = await addRound(ownerDb, s.project, s.admin, codebook, prompt, {
      roundNumber: 2,
      status: 'closed',
    })
    const response = await addResponse(ownerDb, round, item, s.admin)
    const cells = await cellsOf(ownerDb, s.project, codebook)

    auth.userId = s.admin
    const cruzada = {
      definitionId: cells[0].definitionId,
      criterionId: cells[1].criterionId,
    }
    const result = await saveConsensusNote(
      null,
      saveForm(s.project, round, response, cruzada, 'Célula que a tela nunca mostra.'),
    )

    expect(result).toMatchObject({
      error: expect.stringContaining('versão de codebook'),
    })
    expect(await notesOf(response)).toHaveLength(0)
  })

  it('salvar duas vezes edita no lugar: uma linha só, texto novo e updatedAt maior', async () => {
    const s = await scenario()
    auth.userId = s.admin

    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Primeira redação.'),
    )
    const [antes] = await notesOf(s.response)

    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Redação revisada na reunião.'),
    )
    const depois = await notesOf(s.response)

    expect(depois).toHaveLength(1)
    expect(depois[0].id).toBe(antes.id)
    expect(depois[0].text).toBe('Redação revisada na reunião.')
    expect(Date.parse(depois[0].updatedAt)).toBeGreaterThanOrEqual(Date.parse(antes.updatedAt))
  })

  it('a edição de uma célula não encosta na célula vizinha da mesma pessoa', async () => {
    const s = await scenario()
    auth.userId = s.admin

    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Ata da primeira célula.'),
    )
    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[1], 'Ata da segunda célula.'),
    )

    const notas = await notesOf(s.response)
    expect(notas).toHaveLength(2)
    expect(new Set(notas.map((n) => n.criterionId)).size).toBe(2)
  })

  it('texto vazio apaga a anotação, e apagar o que não existe é sucesso sem erro', async () => {
    const s = await scenario()
    auth.userId = s.admin

    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Ata a ser desfeita.'),
    )

    const apagou = await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], '   \n  '),
    )
    expect(apagou).toMatchObject({ ok: true, saved: false })
    expect(await notesOf(s.response)).toHaveLength(0)

    const denovo = await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], ''),
    )
    expect(denovo).toMatchObject({ ok: true, saved: false })
    expect(await notesOf(s.response)).toHaveLength(0)
  })

  it('apagar só apaga a própria anotação: a ata do Administrador sobrevive ao avaliador apagar a dele', async () => {
    const s = await scenario()

    auth.userId = s.admin
    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Ata que fica.'),
    )
    auth.userId = s.evaluatorUser
    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Rascunho que sai.'),
    )
    await saveConsensusNote(null, saveForm(s.project, s.round, s.response, s.cells[0], ''))

    const notas = await notesOf(s.response)
    expect(notas).toHaveLength(1)
    expect(notas[0].projectMemberId).toBe(s.adminMember)
  })

  it('acima do limite é recusado e a anotação anterior fica intacta', async () => {
    const s = await scenario()
    auth.userId = s.admin

    await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Ata curta e correta.'),
    )

    const result = await saveConsensusNote(
      null,
      saveForm(
        s.project,
        s.round,
        s.response,
        s.cells[0],
        'x'.repeat(CONSENSUS_NOTE_MAX + 1),
      ),
    )

    expect(result).toMatchObject({
      error: expect.stringContaining(String(CONSENSUS_NOTE_MAX)),
    })
    const [intacta] = await notesOf(s.response)
    expect(intacta.text).toBe('Ata curta e correta.')
  })

  it('o vínculo inativo não escreve: um avaliador desativado é barrado', async () => {
    const s = await scenario()
    await ownerDb
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(eq(projectMembers.id, s.evaluator))

    auth.userId = s.evaluatorUser
    const result = await saveConsensusNote(
      null,
      saveForm(s.project, s.round, s.response, s.cells[0], 'Já saí do projeto.'),
    )

    expect(result).toMatchObject({
      error: expect.stringContaining('participa deste projeto'),
    })
    expect(await notesOf(s.response)).toHaveLength(0)
  })
})
