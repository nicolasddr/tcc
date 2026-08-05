import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { checkDevLogin, ensureTestUser } from '../lib/dev/session'
import { ownerDb } from '../lib/db'
import { provisionUserOnFirstLogin } from '../lib/auth/provision'

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
  // 1. Guards + usuário de teste — os mesmos que a rota `/dev/login` usa (lib/dev/session).
  //    O profile é criado no passo 2.5 (antes do flip da Fase 4 vinha do trigger
  //    handle_new_user, removido — issue #22).
  const check = checkDevLogin()
  if (!check.ok) {
    throw new Error(`Ambiente de teste inválido: ${check.reason}. Ver .env.test.local.`)
  }
  const { url, publishableKey, secretKey, email, password } = check.config
  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY (service_role local) é obrigatória no E2E. Ver .env.test.local.')
  }
  await ensureTestUser(check.config)

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

  // 2.5. Materializa o profile (o trigger handle_new_user saiu no flip da Fase 4). No app
  //      real isso acontece no auth callback; o E2E injeta a sessão e não passa por lá,
  //      então chamamos o MESMO provisionamento aqui. Idempotente.
  const fullName =
    (signIn.user?.user_metadata?.full_name as string | undefined) ?? email
  await ownerDb.transaction((tx) =>
    provisionUserOnFirstLogin({ id: signIn.user!.id, email, name: fullName }, tx),
  )

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
