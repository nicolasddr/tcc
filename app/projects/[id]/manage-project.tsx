'use client'

import { useActionState } from 'react'
import {
  updateProject,
  setProjectStatus,
  type UpdateProjectState,
} from '@/app/projects/actions'
import { SubmitButton } from '@/app/components/submit-button'

const initialState: UpdateProjectState = null

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
    <form action={action} className="project-form">
      <input type="hidden" name="project_id" value={projectId} />

      <label className="field">
        <span className="field-label">
          Nome <span className="field-required">*</span>
        </span>
        <input
          type="text"
          name="name"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={name}
          className="field-input"
        />
      </label>

      <label className="field">
        <span className="field-label">Descrição</span>
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={description ?? ''}
          placeholder="Opcional — o objetivo do projeto, o contexto da tarefa…"
          className="field-input"
        />
      </label>

      {state && 'error' in state ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state && 'ok' in state ? (
        <p className="form-success" role="status">
          {state.ok}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="btn-role-primary btn-inline" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
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
  className,
  confirmMessage,
}: {
  projectId: string
  from: string
  to: string
  label: string
  pendingText: string
  className: string
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
      <SubmitButton className={className} pendingText={pendingText}>
        {label}
      </SubmitButton>
    </form>
  )
}

export function ManageProject({ projectId, status, name, description }: ManageProjectProps) {
  return (
    <>
      {status === 'active' ? (
        <section className="project-section">
          <h2 className="project-section-title">Editar projeto</h2>
          <EditProjectForm projectId={projectId} name={name} description={description} />
        </section>
      ) : (
        <section className="project-section">
          <h2 className="project-section-title">Editar projeto</h2>
          <p className="form-notice">
            {status === 'completed'
              ? 'Projeto concluído: somente leitura. Reative-o para editar nome ou descrição.'
              : 'Projeto arquivado: somente leitura. Reative-o para editar nome ou descrição.'}
          </p>
        </section>
      )}

      <section className="project-section">
        <h2 className="project-section-title">Status do projeto</h2>
        <div className="project-status-actions">
          {status === 'active' ? (
            <>
              <StatusButton
                projectId={projectId}
                from="active"
                to="completed"
                label="Concluir projeto"
                pendingText="Concluindo…"
                className="btn-secondary btn-inline"
                confirmMessage="Concluir o projeto? Ele fica somente leitura (você pode reativá-lo depois)."
              />
              <StatusButton
                projectId={projectId}
                from="active"
                to="archived"
                label="Arquivar"
                pendingText="Arquivando…"
                className="btn-secondary btn-inline"
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
                className="btn-role-primary btn-inline"
              />
              <StatusButton
                projectId={projectId}
                from="completed"
                to="archived"
                label="Arquivar"
                pendingText="Arquivando…"
                className="btn-secondary btn-inline"
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
              className="btn-role-primary btn-inline"
            />
          ) : null}
        </div>
      </section>
    </>
  )
}
