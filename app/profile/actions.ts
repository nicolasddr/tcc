'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, profiles } from '@/lib/db'

export type UpdateProfileState = { error: string } | { ok: string } | null

// HU-005: o usuário edita o PRÓPRIO nome. O escopo "own" é EXPLÍCITO na app: o WHERE
// filtra por `id = userId` e só `name` é gravado — não dá para alterar o nome de outro
// nem escalar outra coluna. O `$onUpdate` do schema cuida do updated_at. A alteração
// reflete de imediato nas telas que exibem o nome (Server Components) via revalidatePath —
// sem reautenticar. Ver ADR 0007.
export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const userId = await requireUserId()

  const name = String(formData.get('name') ?? '').trim()

  if (!name) return { error: 'Informe um nome.' }

  const updated = await transaction((tx) =>
    tx
      .update(profiles)
      .set({ name })
      .where(eq(profiles.id, userId))
      .returning({ id: profiles.id }),
  )

  // O WHERE filtra o UPDATE por linha (id = userId): se por algum motivo nada foi
  // atualizado, avisamos em vez de fingir sucesso.
  if (updated.length === 0) {
    return { error: 'Não foi possível atualizar seu nome. Tente novamente.' }
  }

  // Refaz as telas que exibem o nome (dashboard, listas de membros dos projetos, etc.).
  revalidatePath('/', 'layout')
  return { ok: 'Nome atualizado.' }
}
