import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ownerDb } from '@/lib/db'
import { provisionUserOnFirstLogin } from '@/lib/auth/provision'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'

  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {

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