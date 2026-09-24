import { and, asc, count, desc, eq } from 'drizzle-orm'
import {
  ownerDb,
  type DbExecutor,
  evaluations,
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
  phase: number
  createdAt: string
  closedAt: string | null
}

export type OpenRound = Round & { codebookVersionId: string }

export type EvaluatedRound = {
  id: string
  roundNumber: number
  status: string
}

export type RoundSummary = Round & {
  authorName: string
  codebookVersionId: string
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
      phase: rounds.phase,
      createdAt: rounds.createdAt,
      closedAt: rounds.closedAt,
      codebookVersionId: rounds.codebookVersionId,
    })
    .from(rounds)
    .where(and(eq(rounds.projectId, projectId), eq(rounds.status, ROUND_OPEN)))
    .limit(1)

  return round ?? null
}

export async function countClosedRounds(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(rounds)
    .where(and(eq(rounds.projectId, projectId), eq(rounds.status, ROUND_CLOSED)))

  return row?.value ?? 0
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
      phase: rounds.phase,
      createdAt: rounds.createdAt,
      closedAt: rounds.closedAt,
      authorName: profiles.name,
      codebookVersionId: rounds.codebookVersionId,
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

/** Rodadas com ao menos uma avaliação enviada, da mais recente para a mais antiga. */
export function listRoundsWithEvaluations(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<EvaluatedRound[]> {
  return db
    .selectDistinct({
      id: rounds.id,
      roundNumber: rounds.roundNumber,
      status: rounds.status,
    })
    .from(rounds)
    .innerJoin(evaluations, eq(evaluations.roundId, rounds.id))
    .where(eq(rounds.projectId, projectId))
    .orderBy(desc(rounds.roundNumber))
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
