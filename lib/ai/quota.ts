import 'server-only'

export const DEFAULT_PROJECT_RESPONSES_MAX = 200

const globalForQuota = globalThis as unknown as {
  __llmResponsesByProject?: Map<string, number>
}

const responsesByProject =
  globalForQuota.__llmResponsesByProject ?? new Map<string, number>()

globalForQuota.__llmResponsesByProject = responsesByProject

export function projectResponsesMax(): number {
  const raw = process.env.LLM_PROJECT_RESPONSES_MAX?.trim()
  if (!raw) return DEFAULT_PROJECT_RESPONSES_MAX

  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_PROJECT_RESPONSES_MAX

  return parsed
}

export function projectResponsesUsed(projectId: string): number {
  return responsesByProject.get(projectId) ?? 0
}

export function projectResponsesLeft(projectId: string): number {
  return Math.max(0, projectResponsesMax() - projectResponsesUsed(projectId))
}

export function hasProjectResponsesLeft(projectId: string): boolean {
  return projectResponsesLeft(projectId) > 0
}

export function countProjectResponse(projectId: string): void {
  responsesByProject.set(projectId, projectResponsesUsed(projectId) + 1)
}

export function resetProjectResponses(): void {
  responsesByProject.clear()
}
