// lib/dev/session.ts — guards e provisionamento do login de desenvolvimento.
//
// ⚠️ SERVER-ONLY (usa a admin API do Supabase) e ⚠️ SÓ LOCAL. Compartilhado por
// `app/dev/login/route.ts` e pelo `global-setup.ts` do Playwright, que precisam do mesmo
// usuário de teste e dos mesmos guards — só divergem em como persistem os cookies.
import { createClient } from '@supabase/supabase-js'

// Hosts aceitos como "Supabase local". É este o guard que sustenta a garantia da rota:
// sem ele, o resto é só configuração.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

export type DevLoginConfig = {
  url: string
  publishableKey: string
  /** service_role LOCAL. Opcional: só é usada para criar o usuário de teste. */
  secretKey: string | undefined
  email: string
  password: string
}

export type DevLoginCheck =
  | { ok: true; config: DevLoginConfig }
  | { ok: false; reason: string }

/**
 * Valida que estamos num ambiente onde o login de desenvolvimento pode existir e devolve
 * a configuração. Falha fechada — na dúvida, `ok: false`.
 *
 * Três condições, em ordem de importância:
 *   1. o Supabase alvo é local (127.0.0.1/localhost) — mesmo que a rota vá para o deploy,
 *      ela não alcança o Supabase remoto;
 *   2. não estamos num build de produção (`next build`/`start` e a Vercel setam NODE_ENV);
 *   3. as credenciais do usuário de teste estão no ambiente (vêm do `.env.test.local`,
 *      que é gitignored — nunca chegam ao repo nem ao deploy).
 */
export function checkDevLogin(): DevLoginCheck {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, reason: 'NODE_ENV=production' }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    return { ok: false, reason: 'NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY ausentes' }
  }

  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return { ok: false, reason: `NEXT_PUBLIC_SUPABASE_URL inválida: ${url}` }
  }
  if (!LOCAL_HOSTS.has(host)) {
    return { ok: false, reason: `Supabase não é local (host: ${host})` }
  }

  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!email || !password) {
    return { ok: false, reason: 'E2E_USER_EMAIL/E2E_USER_PASSWORD ausentes' }
  }

  return {
    ok: true,
    config: { url, publishableKey, secretKey: process.env.SUPABASE_SECRET_KEY, email, password },
  }
}

/**
 * Garante que o usuário de teste existe em `auth.users`. Idempotente.
 *
 * Precisa da service_role LOCAL; sem ela vira no-op, e o login só funciona se o usuário
 * já tiver sido criado antes (por exemplo por um `npm run test:e2e` anterior). Só é
 * chamada depois de `checkDevLogin()` — ou seja, apenas contra o Supabase local.
 */
export async function ensureTestUser(config: DevLoginConfig): Promise<void> {
  if (!config.secretKey) return

  const admin = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await admin.auth.admin.createUser({
    email: config.email,
    password: config.password,
    email_confirm: true,
  })
  // "já existe" é o caso normal a partir da segunda chamada.
  if (error && !/already|registered|exists/i.test(error.message)) throw error
}
