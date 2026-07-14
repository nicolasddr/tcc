// test/helpers.ts — utilidades para os testes de integração (issue #22, Fase 0).
//
// Não é um arquivo de teste (não casa `*.int.test.ts`). Reúne o padrão de
// isolamento por transação-com-rollback e as fixtures da camada de dados,
// espelhando o que o seed pgTAP (`tests.create_user`, etc.) já faz.
import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  type Transaction,
  projects,
  profiles,
  projectMembers,
  projectInvitations,
  onboardingQuestions,
  onboardingResponses,
  notifications,
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
 * trigger `handle_new_user` que materializa o profile. Devolve o id. Passe `email`
 * quando o teste precisar casar um endereço específico (ex.: convite por e-mail).
 */
export async function createUser(
  tx: DbExecutor,
  name = 'Usuário de Teste',
  email = uniqueEmail('user'),
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`select tests.create_user(${email}, ${name}) as id`,
  )
  return rows[0].id
}

/**
 * Cria um projeto e materializa `createdBy` como Administrador ativo. Antes do flip da
 * Fase 4 (issue #22) a linha de admin vinha do trigger auto_add_creator_as_admin; com ele
 * removido, o helper a insere explicitamente — igual à action createProject.
 */
export async function createProject(
  tx: DbExecutor,
  createdBy: string,
  name = 'Projeto de Teste',
): Promise<string> {
  const [row] = await tx.insert(projects).values({ name, createdBy }).returning({ id: projects.id })
  await tx
    .insert(projectMembers)
    .values({ projectId: row.id, userId: createdBy, role: 'administrator', status: 'active' })
  return row.id
}

/** Insere um avaliador ATIVO (satisfaz os CHECKs de consentimento/onboarding). */
export async function addActiveEvaluator(
  tx: DbExecutor,
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
  tx: DbExecutor,
  projectId: string,
  userId: string,
): Promise<string> {
  const [row] = await tx
    .insert(projectMembers)
    .values({ projectId, userId, role: 'evaluator', status: 'pending_onboarding' })
    .returning({ id: projectMembers.id })
  return row.id
}

/** Cria um convite PENDENTE para `inviteeId` no projeto e devolve o id. */
export async function addPendingInvitation(
  tx: DbExecutor,
  projectId: string,
  inviteeId: string,
  invitedBy: string,
): Promise<string> {
  const [row] = await tx
    .insert(projectInvitations)
    .values({
      projectId,
      inviteeId,
      inviteeEmail: uniqueEmail('invitee'),
      invitedBy,
      status: 'pending',
    })
    .returning({ id: projectInvitations.id })
  return row.id
}

/** Liga a flag de plataforma `can_create_projects` no profile. */
export async function grantCreatePermission(tx: DbExecutor, userId: string): Promise<void> {
  await tx.update(profiles).set({ canCreateProjects: true }).where(eq(profiles.id, userId))
}

/** Insere uma pergunta de onboarding no projeto e devolve o id. */
export async function addOnboardingQuestion(
  tx: DbExecutor,
  projectId: string,
  opts: {
    text?: string
    type?: 'open' | 'multiple_choice'
    options?: string[] | null
    orderIndex?: number
  } = {},
): Promise<string> {
  const [row] = await tx
    .insert(onboardingQuestions)
    .values({
      projectId,
      questionText: opts.text ?? 'Pergunta de teste',
      questionType: opts.type ?? 'open',
      options: opts.options ?? null,
      orderIndex: opts.orderIndex ?? 0,
    })
    .returning({ id: onboardingQuestions.id })
  return row.id
}

/** Cria uma notificação para `userId` (não lida) e devolve o id. */
export async function addNotification(
  tx: DbExecutor,
  userId: string,
  type = 'project_invitation',
): Promise<string> {
  const [row] = await tx
    .insert(notifications)
    .values({ userId, type, payload: {} })
    .returning({ id: notifications.id })
  return row.id
}

/** Grava a resposta de onboarding de um membro a uma pergunta. */
export async function addOnboardingResponse(
  tx: DbExecutor,
  projectMemberId: string,
  questionId: string,
  answer: string,
): Promise<void> {
  await tx.insert(onboardingResponses).values({ projectMemberId, questionId, answer })
}

/** id da linha de membership de `userId` no projeto (ex.: o admin criado pelo trigger). */
export async function memberId(
  tx: DbExecutor,
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

/**
 * Apaga as fixtures COMMITADAS de um teste. `inRollbackTx` reverte tudo
 * automaticamente, mas uma Server Action abre a própria transação (`withUser`) e
 * COMMITA — logo não dá para testá-la sob rollback. Nesses testes as fixtures são
 * gravadas via `ownerDb` e removidas aqui no fim. Ordem: projetos ANTES dos
 * usuários (projects.created_by é `on delete restrict`); apagar auth.users cascateia
 * para profiles/memberships. Idempotente e tolerante a ids repetidos.
 */
export async function cleanup(projectIds: string[], userIds: string[]): Promise<void> {
  if (projectIds.length > 0) {
    await ownerDb.delete(projects).where(inArray(projects.id, projectIds))
  }
  for (const id of userIds) {
    await ownerDb.execute(sql`delete from auth.users where id = ${id}`)
  }
}
