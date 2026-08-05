// lib/dev/session.ts — guards e provisionamento do login de desenvolvimento.
//
// ⚠️ SERVER-ONLY (usa a admin API do Supabase) e ⚠️ SÓ LOCAL. Compartilhado por
// `app/dev/login/route.ts` e pelo `global-setup.ts` do Playwright, que precisam do mesmo
// usuário de teste e dos mesmos guards — só divergem em como persistem os cookies.
import { createClient } from '@supabase/supabase-js'

// Hosts aceitos como "Supabase local". É este o guard que sustenta a garantia da rota:
// sem ele, o resto é só configuração.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

/**
 * Conta usada pela rota `/dev/login`, SEPARADA da conta do E2E de propósito: a rota
 * promove quem loga a super-admin (ver `app/dev/login/route.ts`), e o fixture das specs
 * precisa continuar sendo um usuário comum. Como as duas contas vivem no mesmo banco
 * local, compartilhá-las deixaria o E2E dependente de alguém ter aberto a rota ou não.
 */
const DEFAULT_DEV_USER_EMAIL = 'dev@test.local'

export type DevLoginConfig = {
  url: string
  publishableKey: string
  /** service_role LOCAL. Opcional: só é usada para criar os usuários de teste. */
  secretKey: string | undefined
  /** Conta do E2E — fixture das specs, sem privilégios. */
  email: string
  /** Conta da rota `/dev/login` — promovida a super-admin. */
  devEmail: string
  /** Compartilhada pelas duas contas locais. */
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
    config: {
      url,
      publishableKey,
      secretKey: process.env.SUPABASE_SECRET_KEY,
      email,
      devEmail: process.env.DEV_USER_EMAIL || DEFAULT_DEV_USER_EMAIL,
      password,
    },
  }
}

/**
 * Garante que `email` existe em `auth.users`, com a senha local compartilhada.
 * Idempotente. Sem `email`, cria a conta do E2E.
 *
 * Precisa da service_role LOCAL; sem ela vira no-op, e o login só funciona se o usuário
 * já tiver sido criado antes (por exemplo por um `npm run test:e2e` anterior). Só é
 * chamada depois de `checkDevLogin()` — ou seja, apenas contra o Supabase local.
 */
export async function ensureTestUser(
  config: DevLoginConfig,
  email: string = config.email,
): Promise<void> {
  if (!config.secretKey) return

  const admin = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await admin.auth.admin.createUser({
    email,
    password: config.password,
    email_confirm: true,
  })
  // "já existe" é o caso normal a partir da segunda chamada.
  if (error && !/already|registered|exists/i.test(error.message)) throw error
}
