'use client'

import { useActionState, useEffect, useRef } from 'react'
import { inviteEvaluator, type InviteEvaluatorState } from '@/app/projects/actions'

const initialState: InviteEvaluatorState = null

export function InviteEvaluatorForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(inviteEvaluator, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Limpa o e-mail após um convite bem-sucedido para facilitar convidar o próximo.
  useEffect(() => {
    if (state && 'ok' in state) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="invite-form">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="invite-row">
        <label className="field invite-field">
          <span className="field-label">E-mail do avaliador</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="off"
            placeholder="avaliador@exemplo.com"
            className="field-input"
          />
        </label>
        <button type="submit" className="btn-invite" disabled={pending}>
          {pending ? 'Convidando…' : 'Convidar'}
        </button>
      </div>

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
    </form>
  )
}
