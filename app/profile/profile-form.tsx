'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updateProfile, type UpdateProfileState } from './actions'

const initialState: UpdateProfileState = null

export function ProfileForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState(updateProfile, initialState)

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
          autoComplete="name"
          defaultValue={initialName}
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
        <Link href="/dashboard" className="btn-secondary">
          Voltar
        </Link>
        <button type="submit" className="btn-role-primary btn-inline" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
