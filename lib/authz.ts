// lib/authz.ts — autorização na camada de aplicação (issue #22, Fase 0).
//
// Cada função aqui espelha, em TypeScript, um predicado `security definer` que
// hoje vive na migration 0002 (`is_project_admin`, `is_member_of`, etc.). O `userId`
// que na versão SQL vinha de `auth.uid()` passa a ser um ARGUMENTO explícito.
//
// ⚠️ Rodam como DONO (bypassam a RLS), igual ao `security definer` original: um
// predicado precisa enxergar TODAS as linhas para decidir "fulano é admin?",
// independentemente de quem pergunta. Por isso o executor default é `ownerDb`.
// O parâmetro `db` permite injetar uma transação (usado nos testes para rodar sob
// rollback, e nas actions para reaproveitar a transação já aberta).
//
// ⚠️ SERVER-ONLY (importa `lib/db`, que abre conexão TCP). Nunca importar no cliente.
import { and, eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  ownerDb,
  type DbExecutor,
  profiles,
  projectMembers,
  projectInvitations,
  superAdmins,
} from '@/lib/db'

// Roda a query `limit 1` e devolve se veio alguma linha (equivalente ao `exists`).
async function any(rows: Promise<unknown[]>): Promise<boolean> {
  return (await rows).length > 0
}

const ONE = sql<number>`1`

/** É super-admin da plataforma? (espelha `is_super_admin`) */
export function isSuperAdmin(userId: string, db: DbExecutor = ownerDb): Promise<boolean> {
  return any(
    db.select({ one: ONE }).from(superAdmins).where(eq(superAdmins.userId, userId)).limit(1),
  )
}

/** Membro ATIVO do projeto (qualquer papel)? (espelha `is_member_of`) */
export function isMemberOf(
  userId: string,
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<boolean> {
  return any(
    db
      .select({ one: ONE })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
          eq(projectMembers.status, 'active'),
        ),
      )
      .limit(1),
  )
}

/** Tem QUALQUER linha de membership (inclui pending/inactive)? (espelha `is_project_member`) */
export function isProjectMember(
  userId: string,
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<boolean> {
  return any(
    db
      .select({ one: ONE })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .limit(1),
  )
}

/** Administrador ATIVO do projeto? (espelha `is_project_admin`) */
export function isProjectAdmin(
  userId: string,
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<boolean> {
  return any(
    db
      .select({ one: ONE })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
          eq(projectMembers.role, 'administrator'),
          eq(projectMembers.status, 'active'),
        ),
      )
      .limit(1),
  )
}

/** Tem convite PENDENTE para o projeto? (espelha `has_pending_invitation`) */
export function hasPendingInvitation(
  userId: string,
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<boolean> {
  return any(
    db
      .select({ one: ONE })
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.projectId, projectId),
          eq(projectInvitations.inviteeId, userId),
          eq(projectInvitations.status, 'pending'),
        ),
      )
      .limit(1),
  )
}

/**
 * Compartilha algum projeto com `otherUserId`, sendo `userId` membro ATIVO?
 * (espelha `shares_project_with` — self-join de project_members)
 */
export function sharesProjectWith(
  userId: string,
  otherUserId: string,
  db: DbExecutor = ownerDb,
): Promise<boolean> {
  const me = alias(projectMembers, 'me')
  const them = alias(projectMembers, 'them')
  return any(
    db
      .select({ one: ONE })
      .from(me)
      .innerJoin(them, eq(them.projectId, me.projectId))
      .where(
        and(eq(me.userId, userId), eq(me.status, 'active'), eq(them.userId, otherUserId)),
      )
      .limit(1),
  )
}

/**
 * Pode VER a resposta de onboarding do membro `memberId`? — o próprio respondente
 * ou o admin do projeto. (espelha `can_view_response`)
 */
export async function canViewResponse(
  userId: string,
  memberId: string,
  db: DbExecutor = ownerDb,
): Promise<boolean> {
  const [member] = await db
    .select({ userId: projectMembers.userId, projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.id, memberId))
    .limit(1)
  if (!member) return false
  if (member.userId === userId) return true
  return isProjectAdmin(userId, member.projectId, db)
}

/**
 * Pode RESPONDER ao onboarding do membro `memberId`? — precisa ser o próprio
 * membro e ainda estar em `pending_onboarding`. (espelha `can_answer_onboarding`)
 */
export function canAnswerOnboarding(
  userId: string,
  memberId: string,
  db: DbExecutor = ownerDb,
): Promise<boolean> {
  return any(
    db
      .select({ one: ONE })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.id, memberId),
          eq(projectMembers.userId, userId),
          eq(projectMembers.status, 'pending_onboarding'),
        ),
      )
      .limit(1),
  )
}

/** Tem permissão de plataforma para criar projetos? (flag `profiles.can_create_projects`) */
export function canCreateProjects(userId: string, db: DbExecutor = ownerDb): Promise<boolean> {
  return any(
    db
      .select({ one: ONE })
      .from(profiles)
      .where(and(eq(profiles.id, userId), eq(profiles.canCreateProjects, true)))
      .limit(1),
  )
}

/**
 * Resolve o convidado por e-mail para o fluxo de convite (HU-018) — reimplementa a
 * RPC `find_invitee_by_email` (0002). Devolve SÓ `{ id, name }` (nunca o e-mail nem
 * outro dado), ou `null` se não achar.
 *
 * ⚠️ GUARDA ANTI-ENUMERAÇÃO: só resolve o perfil se QUEM convida (`callerId`) tem
 * `can_create_projects`. Sem essa permissão devolve `null` de forma INDISTINGUÍVEL de
 * "e-mail não cadastrado" — quem não pode convidar não consegue sondar se um e-mail
 * existe. (No SQL isso era o `exists(... me.id = auth.uid() and me.can_create_projects)`
 * embutido na mesma query; aqui é a checagem prévia de `canCreateProjects`, mesmo
 * resultado.) Comparação de e-mail case-insensitive, espelhando `lower(email)`.
 */
export async function findInviteeByEmail(
  callerId: string,
  email: string,
  db: DbExecutor = ownerDb,
): Promise<{ id: string; name: string } | null> {
  if (!(await canCreateProjects(callerId, db))) return null
  const [row] = await db
    .select({ id: profiles.id, name: profiles.name })
    .from(profiles)
    .where(eq(sql`lower(${profiles.email})`, email.toLowerCase()))
    .limit(1)
  return row ?? null
}
