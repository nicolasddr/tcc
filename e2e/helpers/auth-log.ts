import { spawnSync } from 'node:child_process'

const AUTH_CONTAINER = 'supabase_auth_tcc'

/**
 * O round-trip de auth do proxy.ts (getUser/getClaims) acontece SERVER-SIDE, no
 * Next — o browser do Playwright não o enxerga. Para observá-lo de verdade, lemos
 * o log do container GoTrue local, que registra cada request como JSON, incluindo
 * o path. `GET /user` é exatamente a chamada que o `getUser()` fazia e que o
 * `getClaims()` (Fase 2) elimina quando o token é válido.
 *
 * Uso (baseline/delta — não depende de relógio nem de `--since`):
 *   const before = countGetUserTotal()
 *   ... navegações autenticadas ...
 *   expect(countGetUserTotal() - before).toBe(0)
 */
function readAuthLogs(): string {
  // ATENÇÃO: o GoTrue emite os logs na STDERR — precisamos juntar os dois fluxos.
  const res = spawnSync('docker', ['logs', AUTH_CONTAINER], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (res.error) throw res.error
  if (res.status !== 0) {
    throw new Error(`docker logs ${AUTH_CONTAINER} falhou (status ${res.status}): ${res.stderr}`)
  }
  return (res.stdout ?? '') + (res.stderr ?? '')
}

/** Total de `GET /user` já registrados pelo GoTrue local desde o boot do container. */
export function countGetUserTotal(): number {
  let count = 0
  for (const line of readAuthLogs().split('\n')) {
    if (line.includes('"path":"/user"') && line.includes('"method":"GET"')) count++
  }
  return count
}
