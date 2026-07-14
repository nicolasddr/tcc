import { createServerClient } from '@supabase/ssr'
import type { JwtPayload } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
          }
        },
      },
    }
  )
}

/**
 * Devolve as claims do access token (ou null quando não há sessão válida).
 *
 * Diferente de `supabase.auth.getUser()`, NÃO faz round-trip ao Supabase Auth: com
 * chaves assimétricas (ES256) o JWT é verificado localmente via WebCrypto, e o JWKS
 * fica em cache. A segurança da request vem do refresh no proxy (`lib/supabase/proxy.ts`,
 * que roda antes) + da autorização na app-layer (lib/authz, checagens nas actions) — ver
 * ADR 0007. Use `claims.sub` como id do usuário.
 *
 * `getClaims()` rejeita token vencido (allowExpired:false) e devolve null — o proxy
 * já terá renovado o cookie nesta mesma request antes de chegarmos aqui.
 */
export async function getClaims(): Promise<JwtPayload | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims ?? null
}