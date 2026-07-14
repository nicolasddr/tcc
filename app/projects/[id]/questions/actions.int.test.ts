// app/projects/[id]/questions/actions.int.test.ts — testes de integração das Server
// Actions de perguntas de onboarding (issue #22): só o admin define/edita/remove
// perguntas; um avaliador não pode. Provam a checagem de admin EXPLÍCITA na app-layer.
//
// Cada action commita via `transaction`: fixtures via `ownerDb`, limpas por `cleanup()`.
// PRÉ-REQUISITO: Supabase LOCAL de pé (`supabase start`).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('@/lib/supabase/server', () => ({
  getClaims: async () => (auth.userId ? { sub: auth.userId } : null),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import { addQuestion, updateQuestion, removeQuestion } from '@/app/projects/[id]/questions/actions'
import { ownerDb, onboardingQuestions } from '@/lib/db'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addOnboardingQuestion,
  cleanup,
} from '@/test/helpers'

function fd(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

describe('app/projects/[id]/questions/actions — só o admin define perguntas', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }
  async function newProject(admin: string): Promise<string> {
    const id = await seedProject(ownerDb, admin)
    projs.push(id)
    return id
  }
  function questionsOf(projectId: string) {
    return ownerDb
      .select({
        id: onboardingQuestions.id,
        text: onboardingQuestions.questionText,
      })
      .from(onboardingQuestions)
      .where(eq(onboardingQuestions.projectId, projectId))
  }

  beforeEach(() => {
    users = []
    projs = []
    auth.userId = null
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('addQuestion: avaliador → erro e nada gravado; admin → cria a pergunta', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)

    auth.userId = evaluator
    const denied = await addQuestion(
      null,
      fd({ project_id: project, question_text: 'pirata', question_type: 'open' }),
    )
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    expect(await questionsOf(project)).toHaveLength(0)

    auth.userId = admin
    const ok = await addQuestion(
      null,
      fd({ project_id: project, question_text: 'Sua formação?', question_type: 'open' }),
    )
    expect(ok).toMatchObject({ ok: true })
    const rows = await questionsOf(project)
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('Sua formação?')
  })

  it('updateQuestion: avaliador → erro e texto inalterado; admin → edita', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const question = await addOnboardingQuestion(ownerDb, project, { text: 'Original' })

    auth.userId = evaluator
    const denied = await updateQuestion(
      null,
      fd({ project_id: project, question_id: question, question_text: 'invasao', question_type: 'open' }),
    )
    expect(denied).toEqual({ error: expect.stringContaining('administrador') })
    const [before] = await ownerDb
      .select({ text: onboardingQuestions.questionText })
      .from(onboardingQuestions)
      .where(eq(onboardingQuestions.id, question))
    expect(before.text).toBe('Original')

    auth.userId = admin
    const ok = await updateQuestion(
      null,
      fd({ project_id: project, question_id: question, question_text: 'Editada', question_type: 'open' }),
    )
    expect(ok).toMatchObject({ ok: true })
    const [after] = await ownerDb
      .select({ text: onboardingQuestions.questionText })
      .from(onboardingQuestions)
      .where(eq(onboardingQuestions.id, question))
    expect(after.text).toBe('Editada')
  })

  it('removeQuestion: avaliador → no-op; admin → remove', async () => {
    const admin = await newUser('Admin')
    const evaluator = await newUser('Avaliador')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, evaluator)
    const question = await addOnboardingQuestion(ownerDb, project)

    auth.userId = evaluator
    await removeQuestion(fd({ project_id: project, question_id: question }))
    expect(await questionsOf(project)).toHaveLength(1)

    auth.userId = admin
    await removeQuestion(fd({ project_id: project, question_id: question }))
    expect(await questionsOf(project)).toHaveLength(0)
  })
})
