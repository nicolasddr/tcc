import { and, asc, eq } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  profiles,
  projectMembers,
  codebookVersions,
  promptVersions,
  rounds,
} from '@/lib/db'

export const ROUND_OPEN = 'open'
export const ROUND_CLOSED = 'closed'

export type Round = {
  id: string
  roundNumber: number
  status: string
  createdAt: string
  closedAt: string | null
}

export type OpenRound = Round & { codebookVersionId: string }

export type RoundSummary = Round & {
  authorName: string
  codebookVersionNumber: number
  promptVersionNumber: number
}

export function isOpen(round: { status: string }): boolean {
  return round.status === ROUND_OPEN
}

export async function loadOpenRound(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<OpenRound | null> {
  const [round] = await db
    .select({
      id: rounds.id,
      roundNumber: rounds.roundNumber,
      status: rounds.status,
      createdAt: rounds.createdAt,
      closedAt: rounds.closedAt,
      codebookVersionId: rounds.codebookVersionId,
    })
    .from(rounds)
    .where(and(eq(rounds.projectId, projectId), eq(rounds.status, ROUND_OPEN)))
    .limit(1)

  return round ?? null
}

export function listRounds(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<RoundSummary[]> {
  return db
    .select({
      id: rounds.id,
      roundNumber: rounds.roundNumber,
      status: rounds.status,
      createdAt: rounds.createdAt,
      closedAt: rounds.closedAt,
      authorName: profiles.name,
      codebookVersionNumber: codebookVersions.versionNumber,
      promptVersionNumber: promptVersions.versionNumber,
    })
    .from(rounds)
    .innerJoin(profiles, eq(profiles.id, rounds.createdBy))
    .innerJoin(codebookVersions, eq(codebookVersions.id, rounds.codebookVersionId))
    .innerJoin(promptVersions, eq(promptVersions.id, rounds.promptVersionId))
    .where(eq(rounds.projectId, projectId))
    .orderBy(asc(rounds.roundNumber))
}

export async function listEvaluatorsNotFinished(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<string[]> {
  const rows = await db
    .select({ name: profiles.name })
    .from(projectMembers)
    .innerJoin(profiles, eq(profiles.id, projectMembers.userId))
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.role, 'evaluator'),
        eq(projectMembers.status, 'active'),
      ),
    )
    .orderBy(asc(profiles.name))

  return rows.map((row) => row.name)
}
