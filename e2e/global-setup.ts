import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const STORAGE_PATH = path.join(__dirname, '.auth', 'user.json')

/**
 * Gera uma sessão autenticada real SEM passar pela tela do Google, e a persiste
 * como `storageState` do Playwright. Fluxo:
 *   1. admin (service_role local) garante o usuário de teste (idempotente);
 *   2. login por senha → tokens ES256 reais do Supabase local;
 *   3. os cookies `sb-...-auth-token` são gerados pela PRÓPRIA @supabase/ssr
 *      (mesma lib do app), então o formato/chunking bate exatamente com o que o
 *      proxy.ts espera — nada de cookie montado à mão;
 *   4. grava o storageState que todas as specs reusam.
 */
async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!url || !publishableKey || !secretKey || !email || !password) {
    throw new Error(
      'Faltam envs de teste (NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, E2E_USER_*). Ver .env.test.local.'
    )
  }

  // 1. Garante o usuário de teste. O trigger on_auth_user_created materializa o profile.
  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr && !/already|registered|exists/i.test(createErr.message)) {
    throw createErr
  }

  // 2. Login por senha → tokens reais (ES256, assinados pela signing key local).
  const anon = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password,
  })
  if (signInErr || !signIn.session) {
    throw signInErr ?? new Error('Login de teste não retornou sessão')
  }
  const { access_token, refresh_token } = signIn.session

  // 3. Deixa a @supabase/ssr produzir os cookies (captura via setAll em memória).
  const cookies: { name: string; value: string }[] = []
  const ssr = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => [],
      setAll: (toSet) => {
        for (const { name, value } of toSet) cookies.push({ name, value })
      },
    },
  })
  await ssr.auth.setSession({ access_token, refresh_token })
  if (cookies.length === 0) {
    throw new Error('setSession() não escreveu nenhum cookie de auth')
  }

  // 4. storageState — cookies no host do app (127.0.0.1), independentes de porta.
  const storageState = {
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: '127.0.0.1',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    })),
    origins: [],
  }
  mkdirSync(path.dirname(STORAGE_PATH), { recursive: true })
  writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2))
  console.log(`[global-setup] sessão de ${email} salva em ${STORAGE_PATH} (${cookies.length} cookie(s))`)
}

export default globalSetup
