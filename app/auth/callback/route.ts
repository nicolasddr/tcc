import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ownerDb } from '@/lib/db'
import { provisionUserOnFirstLogin } from '@/lib/auth/provision'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Provisiona o usuário na app-layer (substitui o trigger handle_new_user, que sai
      // no flip da Fase 4 — issue #22): cria o perfil no 1º login, vincula convites por
      // e-mail pendentes e emite as notificações. Idempotente e atômico (uma transação);
      // coexiste com o trigger até ele ser removido. `name` espelha o coalesce do trigger.
      const u = data.user
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>
      const name =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        u.email ||
        u.id
      await ownerDb.transaction((tx) =>
        provisionUserOnFirstLogin({ id: u.id, email: u.email ?? '', name }, tx),
      )
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`)
}