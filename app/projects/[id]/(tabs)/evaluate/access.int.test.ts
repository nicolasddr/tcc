import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOTFOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import { requireEvaluator } from '@/app/projects/[id]/(tabs)/evaluate/access'
import { PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'
import { ownerDb, projectMembers } from '@/lib/db'
import { eq } from 'drizzle-orm'
import {
  createUser,
  createProject as seedProject,
  addActiveEvaluator,
  addPendingMember,
  memberId as memberIdOf,
  cleanup,
} from '@/test/helpers'

const ABSENT = '00000000-0000-4000-8000-000000000000'

describe('app/projects/[id]/evaluate/access — quem entra na tela do avaliador', () => {
  let users: string[]
  let projs: string[]

  async function newUser(name?: string): Promise<string> {
    const id = await createUser(ownerDb, name)
    users.push(id)
    return id
  }

  async function newProject(admin: string): Promise<string> {
    const id = await seedProject(ownerDb, admin, 'Projeto de Teste', { phase: PHASE_2 })
    projs.push(id)
    return id
  }

  beforeEach(() => {
    users = []
    projs = []
  })
  afterEach(async () => {
    await cleanup(projs, users)
  })

  it('o avaliador ativo entra, e recebe o projeto e o próprio vínculo', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const evaluator = await newUser('Avaliadora')
    await addActiveEvaluator(ownerDb, project, evaluator)

    const access = await requireEvaluator(project, evaluator)
    expect(access.project).toMatchObject({ id: project, name: 'Projeto de Teste' })
    expect(access.memberId).toBe(await memberIdOf(ownerDb, project, evaluator))
  })

  it('o administrador sem vínculo de avaliador leva notFound', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)

    await expect(requireEvaluator(project, admin)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o administrador-avaliador entra pelo vínculo de avaliador', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    await addActiveEvaluator(ownerDb, project, admin)

    const access = await requireEvaluator(project, admin)
    const [member] = await ownerDb
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(eq(projectMembers.id, access.memberId))
    expect(member.role).toBe('evaluator')
  })

  it('quem não é membro leva notFound', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const stranger = await newUser('Estranha')

    await expect(requireEvaluator(project, stranger)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o avaliador em pending_onboarding é mandado para o onboarding', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const evaluator = await newUser('Avaliadora')
    await addPendingMember(ownerDb, project, evaluator)

    await expect(requireEvaluator(project, evaluator)).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${project}/onboarding`,
    )
  })

  it('o vínculo inativo leva notFound', async () => {
    const admin = await newUser('Admin')
    const project = await newProject(admin)
    const evaluator = await newUser('Avaliadora')
    const member = await addActiveEvaluator(ownerDb, project, evaluator)
    await ownerDb
      .update(projectMembers)
      .set({ status: 'inactive' })
      .where(eq(projectMembers.id, member))

    await expect(requireEvaluator(project, evaluator)).rejects.toThrow('NEXT_NOTFOUND')
  })

  it('o projeto inexistente leva notFound', async () => {
    const evaluator = await newUser('Avaliadora')

    await expect(requireEvaluator(ABSENT, evaluator)).rejects.toThrow('NEXT_NOTFOUND')
  })
})
