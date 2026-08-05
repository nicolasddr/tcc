// app/dev/login/route.ts — atalho de login LOCAL, para desenvolvimento e testes.
//
// Emite uma sessão real (os mesmos cookies `sb-…-auth-token` que o fluxo do Google
// produz) sem passar pela tela do provedor. Serve para abrir as telas autenticadas em
// dev e no E2E sem depender do OAuth — que num navegador automatizado não é viável.
//
// ⚠️ Esta rota cria sessão sem credencial de usuário. Ela é INERTE fora do ambiente
// local: `checkDevLogin()` exige (1) Supabase apontando para 127.0.0.1/localhost,
// (2) NODE_ENV != production e (3) `E2E_USER_*` no ambiente (que moram no
// `.env.test.local`, gitignored). O guard (1) é o que sustenta a garantia — mesmo que a
// rota vá para o deploy, ela não consegue emitir sessão contra o Supabase remoto. Falha
// fechada, com 404 e não 403: não anuncia que existe.
//
// O `?next=` segue a mesma regra do callback do OAuth (só caminho relativo), para não
// virar um open redirect — ver `app/auth/callback/route.ts`.
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { ownerDb, profiles, superAdmins, type DbExecutor } from '@/lib/db'
import { provisionUserOnFirstLogin } from '@/lib/auth/provision'
import { checkDevLogin, ensureTestUser } from '@/lib/dev/session'

/**
 * Dá ao usuário de desenvolvimento os privilégios que ele não teria no fluxo real:
 * `can_create_projects` (que nasce `false` e depende de aprovação de um super-admin) e
 * super-admin da plataforma (para alcançar `/admin/permissions`). Sem isso a conta local
 * é um beco sem saída — não dá para criar projeto nem para se auto-aprovar.
 *
 * Idempotente. Só roda depois de `checkDevLogin()`, ou seja, apenas no banco local, que é
 * descartável (`supabase db reset`). Atinge só a conta `devEmail`: o fixture do E2E é
 * outro usuário, justamente para não herdar estes privilégios.
 */
async function grantDevPrivileges(userId: string, db: DbExecutor): Promise<void> {
  await db.update(profiles).set({ canCreateProjects: true }).where(eq(profiles.id, userId))
  await db.insert(superAdmins).values({ userId }).onConflictDoNothing()
}

export async function GET(request: Request) {
  const check = checkDevLogin()
  if (!check.ok) {
    console.warn(`[dev/login] bloqueado: ${check.reason}`)
    return new NextResponse('Not Found', { status: 404 })
  }
  const { config } = check

  const { searchParams, origin } = new URL(request.url)
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  // Conta própria da rota (`devEmail`), separada da conta do E2E — ver lib/dev/session.ts.
  await ensureTestUser(config, config.devEmail)

  // O client de servidor escreve os cookies de sessão pela própria @supabase/ssr, então o
  // formato/chunking é idêntico ao do fluxo real e o proxy.ts os entende sem gambiarra.
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: config.devEmail,
    password: config.password,
  })
  if (error || !data.user) {
    console.error('[dev/login] login falhou:', error?.message)
    return new NextResponse(`Login de desenvolvimento falhou: ${error?.message}`, { status: 500 })
  }

  // Mesmo provisionamento do 1º login do fluxo real (perfil + convites pendentes).
  // Idempotente, então repetir a cada chamada é no-op.
  const u = data.user
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    u.email ||
    u.id
  await ownerDb.transaction(async (tx) => {
    await provisionUserOnFirstLogin({ id: u.id, email: u.email ?? '', name }, tx)
    await grantDevPrivileges(u.id, tx)
  })

  return NextResponse.redirect(`${origin}${next}`)
}
