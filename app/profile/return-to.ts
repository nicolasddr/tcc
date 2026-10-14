const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PROJECT_PATH = new RegExp(`^/projects/(${UUID})(?:[/?#]|$)`, 'i')
const NO_RETURN = /^\/(?:profile|login|auth)(?:[/?#]|$)/

export function safeReturnPath(from: unknown): string | null {
  if (typeof from !== 'string') return null
  if (!from.startsWith('/') || from.startsWith('//')) return null
  if (/[\u0000-\u001f\\]/.test(from)) return null
  if (NO_RETURN.test(from)) return null
  return from
}

export function projectIdOf(path: string): string | null {
  return PROJECT_PATH.exec(path)?.[1] ?? null
}

export function profileHref(pathname: string, search: string): string {
  if (pathname === '/profile') return search ? `/profile?${search}` : '/profile'
  const from = search ? `${pathname}?${search}` : pathname
  return `/profile?${new URLSearchParams({ from })}`
}
