// test/helpers.ts — utilidades para os testes de integração (issue #22, Fase 0).
//
// Não é um arquivo de teste (não casa `*.int.test.ts`). Reúne o padrão de
// isolamento por transação-com-rollback e as fixtures da camada de dados,
// espelhando o que o seed pgTAP (`tests.create_user`, etc.) já faz.
import { and, eq, sql } from 'drizzle-orm'
import {
  ownerDb,
  type Transaction,
  projects,
  profiles,
  projectMembers,
  projectInvitations,
} from '@/lib/db'

const ROLLBACK = Symbol('rollback')

/**
 * Roda `run` dentro de uma transação que é SEMPRE revertida ao final — os
 * predicados recebem essa mesma `tx`, então enxergam as fixtures, e nada suja o
 * banco local. Espelha o `begin; … rollback;` de cada arquivo pgTAP.
 */
export async function inRollbackTx(run: (tx: Transaction) => Promise<void>): Promise<void> {
  try {
    await ownerDb.transaction(async (tx) => {
      await run(tx)
      throw ROLLBACK
    })
  } catch (e) {
    if (e !== ROLLBACK) throw e
  }
}

// E-mail único por fixture: como tudo roda sob rollback, colisão seria só entre
// usuários da MESMA transação — o sufixo aleatório resolve.
function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}@test.local`
}

/**
 * Cria um usuário em auth.users via `tests.create_user` (do seed), disparando o
 * trigger `handle_new_user` que materializa o profile. Devolve o id.
 */
export async function createUser(tx: Transaction, name = 'Usuário de Teste'): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`select tests.create_user(${uniqueEmail('user')}, ${name}) as id`,
  )
  return rows[0].id
}

/** Cria um projeto; o trigger `auto_add_creator_as_admin` torna `createdBy` admin ativo. */
export async function createProject(
  tx: Transaction,
  createdBy: string,
  name = 'Projeto de Teste',
): Promise<string> {
  const [row] = await tx.insert(projects).values({ name, createdBy }).returning({ id: projects.id })
  return row.id
}

/** Insere um avaliador ATIVO (satisfaz os CHECKs de consentimento/onboarding). */
export async function addActiveEvaluator(
  tx: Transaction,
  projectId: string,
  userId: string,
): Promise<string> {
  const now = new Date().toISOString()
  const [row] = await tx
    .insert(projectMembers)
    .values({
      projectId,
      userId,
      role: 'evaluator',
      status: 'active',
      consentAcceptedAt: now,
      consentTextSnapshot: 'Consentimento de teste.',
      onboardingCompletedAt: now,
    })
    .returning({ id: projectMembers.id })
  return row.id
}

/** Insere um avaliador ainda em `pending_onboarding` (sem consentimento exigido). */
export async function addPendingMember(
  tx: Transaction,
  projectId: string,
  userId: string,
): Promise<string> {
  const [row] = await tx
    .insert(projectMembers)
    .values({ projectId, userId, role: 'evaluator', status: 'pending_onboarding' })
    .returning({ id: projectMembers.id })
  return row.id
}

/** Cria um convite PENDENTE para `inviteeId` no projeto. */
export async function addPendingInvitation(
  tx: Transaction,
  projectId: string,
  inviteeId: string,
  invitedBy: string,
): Promise<void> {
  await tx.insert(projectInvitations).values({
    projectId,
    inviteeId,
    inviteeEmail: uniqueEmail('invitee'),
    invitedBy,
    status: 'pending',
  })
}

/** Liga a flag de plataforma `can_create_projects` no profile. */
export async function grantCreatePermission(tx: Transaction, userId: string): Promise<void> {
  await tx.update(profiles).set({ canCreateProjects: true }).where(eq(profiles.id, userId))
}

/** id da linha de membership de `userId` no projeto (ex.: o admin criado pelo trigger). */
export async function memberId(
  tx: Transaction,
  projectId: string,
  userId: string,
): Promise<string> {
  const [row] = await tx
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1)
  return row.id
}
