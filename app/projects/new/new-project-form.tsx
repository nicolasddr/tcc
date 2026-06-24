'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createProject, type CreateProjectState } from '@/app/projects/actions'
import { TASK_TYPE_OPTIONS } from '@/app/projects/task-types'

const initialState: CreateProjectState = null

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProject, initialState)

  return (
    <form action={action} className="project-form">
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
          placeholder="Ex.: Classificação de intenção de busca"
          className="field-input"
        />
      </label>

      <label className="field">
        <span className="field-label">Descrição</span>
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          placeholder="Opcional — o objetivo do projeto, o contexto da tarefa…"
          className="field-input"
        />
      </label>

      <label className="field">
        <span className="field-label">Tipo de tarefa</span>
        <select name="task_type" defaultValue="" className="field-input">
          <option value="">Não declarar agora</option>
          {TASK_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="field-hint">
          Opcional. Só personaliza dicas durante a autoria do codebook mais adiante; não
          muda o restante do processo.
        </span>
      </label>

      {state?.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="form-actions">
        <Link href="/dashboard" className="btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn-role-primary btn-inline" disabled={pending}>
          {pending ? 'Criando…' : 'Criar projeto'}
        </button>
      </div>
    </form>
  )
}
