'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeTaskType } from './task-types'

export type CreateProjectState = { error: string } | null

// HU-012/013: cria um projeto. A RLS (projects_insert) exige can_create_projects;
// o trigger auto_add_creator_as_admin materializa o criador como Administrador
// ativo. Aqui só validamos nome (obrigatório) e normalizamos o tipo (opcional).
export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const taskType = normalizeTaskType(String(formData.get('task_type') ?? ''))

  if (!name) return { error: 'Informe um nome para o projeto.' }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      description: description || null,
      task_type: taskType,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    // Sem can_create_projects, a RLS barra o INSERT (a fatia 08 entrega o fluxo de
    // pedir permissão; por ora basta avisar).
    return {
      error:
        'Não foi possível criar o projeto. Verifique se você tem permissão para criar projetos.',
    }
  }

  redirect(`/projects/${data.id}`)
}
