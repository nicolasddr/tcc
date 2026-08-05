'use client'

import { useActionState } from 'react'
import {
  updateProject,
  setProjectStatus,
  type UpdateProjectState,
} from '@/app/projects/actions'
import { SubmitButton } from '@/app/components/submit-button'
import { Button, type ButtonVariant } from '@/app/components/ui/button'
import { Field, Input, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Alert } from '@/app/components/ui/alert'
import { Section } from '@/app/components/ui/section'

const initialState: UpdateProjectState = null

const statusHint: Record<string, string> = {
  active:
    'Concluir ou arquivar deixa o projeto somente leitura — você pode reativá-lo depois.',
  completed:
    'O projeto está concluído e somente leitura. Reative para voltar a editá-lo, ou arquive para tirá-lo da lista padrão.',
  archived:
    'O projeto está arquivado e fora da lista padrão do dashboard. Reative para voltar a editá-lo.',
}

type ManageProjectProps = {
  projectId: string
  status: string
  name: string
  description: string | null
}

// HU-014/016: formulário de edição de nome/descrição — só renderizado com o projeto
// `active` (concluído/arquivado é somente leitura). Usa updateProject via useActionState.
function EditProjectForm({
  projectId,
  name,
  description,
}: {
  projectId: string
  name: string
  description: string | null
}) {
  const [state, action, pending] = useActionState(updateProject, initialState)

  return (
    <Form action={action}>
      <input type="hidden" name="project_id" value={projectId} />

      <Field label="Nome" required>
        <Input
          type="text"
          name="name"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={name}
        />
      </Field>

      <Field label="Descrição">
        <Textarea
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={description ?? ''}
          placeholder="Opcional — o objetivo do projeto, o contexto da tarefa…"
        />
      </Field>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? <Alert tone="success">{state.ok}</Alert> : null}

      <FormActions align="start">
        <Button type="submit" loading={pending} loadingText="Salvando…">
          Salvar alterações
        </Button>
      </FormActions>
    </Form>
  )
}

// Botão de transição de status (concluir/arquivar/reativar). Confirma antes de enviar
// quando a ação torna o projeto somente leitura (concluir/arquivar).
function StatusButton({
  projectId,
  from,
  to,
  label,
  pendingText,
  variant,
  confirmMessage,
}: {
  projectId: string
  from: string
  to: string
  label: string
  pendingText: string
  variant: ButtonVariant
  confirmMessage?: string
}) {
  return (
    <form
      action={setProjectStatus}
      onSubmit={(e) => {
        if (confirmMessage && !confirm(confirmMessage)) e.preventDefault()
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <SubmitButton variant={variant} pendingText={pendingText}>
        {label}
      </SubmitButton>
    </form>
  )
}

export function ManageProject({ projectId, status, name, description }: ManageProjectProps) {
  return (
    <>
      <Section
        title="Editar projeto"
        hint="Nome e descrição ficam visíveis para todos os membros do projeto."
      >
        {status === 'active' ? (
          <EditProjectForm projectId={projectId} name={name} description={description} />
        ) : (
          <Alert tone="notice">
            {status === 'completed'
              ? 'Projeto concluído: somente leitura. Reative-o para editar nome ou descrição.'
              : 'Projeto arquivado: somente leitura. Reative-o para editar nome ou descrição.'}
          </Alert>
        )}
      </Section>

      <Section title="Status do projeto" hint={statusHint[status]}>
        <div className="flex flex-wrap gap-3">
          {status === 'active' ? (
            <>
              <StatusButton
                projectId={projectId}
                from="active"
                to="completed"
                label="Concluir projeto"
                pendingText="Concluindo…"
                variant="secondary"
                confirmMessage="Concluir o projeto? Ele fica somente leitura (você pode reativá-lo depois)."
              />
              <StatusButton
                projectId={projectId}
                from="active"
                to="archived"
                label="Arquivar"
                pendingText="Arquivando…"
                variant="secondary"
                confirmMessage="Arquivar o projeto? Ele sai da lista padrão e fica somente leitura (você pode reativá-lo depois)."
              />
            </>
          ) : null}

          {status === 'completed' ? (
            <>
              <StatusButton
                projectId={projectId}
                from="completed"
                to="active"
                label="Reativar"
                pendingText="Reativando…"
                variant="primary"
              />
              <StatusButton
                projectId={projectId}
                from="completed"
                to="archived"
                label="Arquivar"
                pendingText="Arquivando…"
                variant="secondary"
                confirmMessage="Arquivar o projeto? Ele sai da lista padrão (você pode reativá-lo depois)."
              />
            </>
          ) : null}

          {status === 'archived' ? (
            <StatusButton
              projectId={projectId}
              from="archived"
              to="active"
              label="Reativar"
              pendingText="Reativando…"
              variant="primary"
            />
          ) : null}
        </div>
      </Section>
    </>
  )
}
