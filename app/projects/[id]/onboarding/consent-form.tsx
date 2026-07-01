'use client'

import { useActionState } from 'react'
import {
  completeOnboarding,
  abandonOnboarding,
  type OnboardingState,
} from '@/app/onboarding/actions'

const initialState: OnboardingState = null

export function ConsentForm({
  projectId,
  consentText,
}: {
  projectId: string
  consentText: string
}) {
  const [state, action, pending] = useActionState(completeOnboarding, initialState)

  return (
    <>
      <div className="consent-box">
        <p className="consent-text">{consentText}</p>
      </div>

      <form action={action} className="consent-form">
        <input type="hidden" name="project_id" value={projectId} />
        <label className="consent-check">
          <input type="checkbox" name="consent" />
          <span>Li e aceito o termo de consentimento acima.</span>
        </label>

        {state && 'error' in state ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="consent-actions">
          <button type="submit" className="btn-invite btn-inline" disabled={pending}>
            {pending ? 'Concluindo…' : 'Concluir onboarding'}
          </button>
        </div>
      </form>

      {/* Abandonar: apaga a linha pendente e devolve o convite para pendente. Form
          separado para não arrastar a validação/pending do consentimento. */}
      <form action={abandonOnboarding} className="consent-abandon">
        <input type="hidden" name="project_id" value={projectId} />
        <button type="submit" className="btn-decline">
          Abandonar
        </button>
      </form>
    </>
  )
}
