'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getClaims } from '@/lib/supabase/server'
import { withUser, profiles } from '@/lib/db'

export type UpdateProfileState = { error: string } | { ok: string } | null

// HU-005: o usuário edita o PRÓPRIO nome. UPDATE via Drizzle sob `withUser` (papel
// `authenticated`), então a RLS (profiles_update_own: `id = auth.uid()`) e o grant de
// coluna (só `name` é atualizável por authenticated — migration 0002) continuam valendo:
// não dá para alterar o nome de outro usuário nem escalar outra coluna. O trigger
// profiles_set_updated_at cuida do updated_at. A alteração reflete de imediato nas telas
// que exibem o nome (Server Components) via revalidatePath — sem reautenticar. Ver ADR 0007.
export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const claims = await getClaims()
  if (!claims) redirect('/login')
  const userId = claims.sub

  const name = String(formData.get('name') ?? '').trim()

  if (!name) return { error: 'Informe um nome.' }

  const updated = await withUser(userId, (tx) =>
    tx
      .update(profiles)
      .set({ name })
      .where(eq(profiles.id, userId))
      .returning({ id: profiles.id }),
  )

  // A RLS filtra o UPDATE por linha: se por algum motivo nada foi atualizado, avisamos
  // em vez de fingir sucesso.
  if (updated.length === 0) {
    return { error: 'Não foi possível atualizar seu nome. Tente novamente.' }
  }

  // Refaz as telas que exibem o nome (dashboard, listas de membros dos projetos, etc.).
  revalidatePath('/', 'layout')
  return { ok: 'Nome atualizado.' }
}
