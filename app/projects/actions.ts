'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeTaskType } from './task-types'

export type CreateProjectState = { error: string } | null

export type InviteEvaluatorState = { error: string } | { ok: string } | null

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

// HU-018 (parcial) / HU-010: o Administrador convida um avaliador JÁ CADASTRADO
// pelo e-mail. find_invitee_by_email devolve só id+name (sem enumerar e-mails) e
// só responde a quem pode criar projetos. O INSERT é gated pela RLS (inv_insert,
// exige is_project_admin); o trigger check_invitation_target barra membro ativo e o
// índice único barra convite pendente duplicado; notify_on_invitation cria a
// notificação in-platform. Convidar quem ainda não tem conta é a fatia 07 (ADR 0006).
export async function inviteEvaluator(
  _prev: InviteEvaluatorState,
  formData: FormData,
): Promise<InviteEvaluatorState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = String(formData.get('project_id') ?? '')
  const email = String(formData.get('email') ?? '').trim()

  if (!projectId) return { error: 'Projeto inválido.' }
  if (!email) return { error: 'Informe o e-mail do avaliador.' }

  const { data: invitee } = await supabase
    .rpc('find_invitee_by_email', { p_email: email })
    .maybeSingle<{ id: string; name: string }>()

  if (!invitee) {
    return {
      error:
        'Nenhum usuário cadastrado com esse e-mail. Por enquanto só é possível convidar quem já entrou ao menos uma vez.',
    }
  }

  const { error } = await supabase.from('project_invitations').insert({
    project_id: projectId,
    invitee_id: invitee.id,
    invited_by: user.id,
    status: 'pending',
  })

  if (error) {
    // 23505: índice único (convite pendente já existe). Demais (P0001 do
    // check_invitation_target / RLS): já é membro ativo ou sem permissão.
    if (error.code === '23505') {
      return { error: `${invitee.name} já tem um convite pendente neste projeto.` }
    }
    return {
      error: `Não foi possível convidar ${invitee.name}. Talvez já seja membro ativo do projeto.`,
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return { ok: `Convite enviado para ${invitee.name}.` }
}
