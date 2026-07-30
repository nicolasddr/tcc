
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  ownerDb,
  type DbExecutor,
  profiles,
  projects,
  projectMembers,
  projectInvitations,
  platformPermissionRequests,
  superAdmins,
} from '@/lib/db'

// Roda a query `limit 1` e devolve se veio alguma linha (equivalente ao `exists`).
async function any(rows: Promise<unknown[]>): Promise<boolean> {
  return (await rows).length > 0
}

const ONE = sql<number>`1`

/** É super-admin da plataforma? */
export function isSuperAdmin(userId: string, db: DbExecutor = ownerDb): Promise<boolean> {
  return any(
    db.select({ one: ONE }).from(superAdmins).where(eq(superAdmins.userId, userId)).limit(1),
  )
}

/** Membro ATIVO do projeto (qualquer papel)? */
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

/** Tem QUALQUER linha de membership (inclui pending/inactive)? */
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

/** Administrador ATIVO do projeto? */
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

/** Tem convite PENDENTE para o projeto? */
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
 * (self-join de project_members)
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
 * ou o admin do projeto.
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
 * membro e ainda estar em `pending_onboarding`.
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
 * Tem uma solicitação de permissão de criação de projetos ainda PENDENTE? (fatia 08)
 * Usado pela página /projects/new para mostrar "aguardando aprovação" em vez de reoferecer
 * o botão de solicitar. O índice único parcial `ppr_one_pending_per_user` garante que só
 * exista uma pendente por usuário.
 */
export function hasPendingPermissionRequest(
  userId: string,
  db: DbExecutor = ownerDb,
): Promise<boolean> {
  return any(
    db
      .select({ one: ONE })
      .from(platformPermissionRequests)
      .where(
        and(
          eq(platformPermissionRequests.userId, userId),
          eq(platformPermissionRequests.status, 'pending'),
        ),
      )
      .limit(1),
  )
}

export type PendingPermissionRequest = {
  requestId: string
  userId: string
  userName: string
  userEmail: string
  createdAt: string
}

/**
 * Lista as solicitações de permissão de criação de projetos ainda PENDENTES, já com o nome
 * e o e-mail de quem pediu, para a página de revisão do super-admin (fatia 08 / HU-033).
 * Só o super-admin chama isto (a página checa `isSuperAdmin` antes). Ordena da mais antiga
 * para a mais recente (fila: quem esperou mais aparece primeiro).
 */
export function listPendingPermissionRequests(
  db: DbExecutor = ownerDb,
): Promise<PendingPermissionRequest[]> {
  return db
    .select({
      requestId: platformPermissionRequests.id,
      userId: platformPermissionRequests.userId,
      userName: profiles.name,
      userEmail: profiles.email,
      createdAt: platformPermissionRequests.createdAt,
    })
    .from(platformPermissionRequests)
    .innerJoin(profiles, eq(profiles.id, platformPermissionRequests.userId))
    .where(eq(platformPermissionRequests.status, 'pending'))
    .orderBy(asc(platformPermissionRequests.createdAt))
}

/**
 * Resolve o convidado por e-mail para o fluxo de convite (HU-018). Devolve SÓ
 * `{ id, name }` (nunca o e-mail nem outro dado), ou `null` se não achar.
 *
 * ⚠️ GUARDA ANTI-ENUMERAÇÃO: só resolve o perfil se QUEM convida (`callerId`) tem
 * `can_create_projects`. Sem essa permissão devolve `null` de forma INDISTINGUÍVEL de
 * "e-mail não cadastrado" — quem não pode convidar não consegue sondar se um e-mail
 * existe. Comparação de e-mail case-insensitive (`lower(email)`).
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

export type PendingInvitation = {
  invitationId: string
  projectId: string
  projectName: string
  inviterName: string | null
  createdAt: string
}

/**
 * Lista os convites PENDENTES do PRÓPRIO usuário, já com o nome do projeto e de quem
 * convidou.
 *
 * O escopo é EXPLÍCITO (`invitee_id = userId`), então o `left join` que traz o nome de
 * quem convidou não vaza nada de terceiros: só o próprio inbox de convites. Ordena do
 * mais recente ao mais antigo.
 */
export function listMyPendingInvitations(
  userId: string,
  db: DbExecutor = ownerDb,
): Promise<PendingInvitation[]> {
  const inviter = alias(profiles, 'inviter')
  return db
    .select({
      invitationId: projectInvitations.id,
      projectId: projectInvitations.projectId,
      projectName: projects.name,
      inviterName: inviter.name,
      createdAt: projectInvitations.createdAt,
    })
    .from(projectInvitations)
    .innerJoin(projects, eq(projects.id, projectInvitations.projectId))
    .leftJoin(inviter, eq(inviter.id, projectInvitations.invitedBy))
    .where(
      and(eq(projectInvitations.inviteeId, userId), eq(projectInvitations.status, 'pending')),
    )
    .orderBy(desc(projectInvitations.createdAt))
}
