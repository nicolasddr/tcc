'use client'

import { useActionState } from 'react'
import {
  completeOnboarding,
  abandonOnboarding,
  type OnboardingState,
} from '@/app/onboarding/actions'
import { OTHER_VALUE, type OnboardingQuestion } from '@/app/onboarding/questions'
import { SubmitButton } from '@/app/components/submit-button'
import { Button } from '@/app/components/ui/button'
import { Input, Textarea } from '@/app/components/ui/field'
import { Alert } from '@/app/components/ui/alert'

const initialState: OnboardingState = null

export function ConsentForm({
  projectId,
  consentText,
  questions,
}: {
  projectId: string
  consentText: string
  questions: OnboardingQuestion[]
}) {
  const [state, action, pending] = useActionState(completeOnboarding, initialState)

  return (
    <>
      <form action={action} className="consent-form">
        <input type="hidden" name="project_id" value={projectId} />

        {/* Perguntas de onboarding (HU-028/032): todas obrigatórias. */}
        {questions.length > 0 ? (
          <div className="onboarding-questions">
            {questions.map((q, i) => (
              <fieldset key={q.id} className="onboarding-question">
                <legend className="field-label">
                  {i + 1}. {q.questionText}
                </legend>

                {q.questionType === 'open' ? (
                  <Textarea
                    name={`q_${q.id}`}
                    rows={2}
                    required
                    placeholder="Sua resposta"
                  />
                ) : (
                  <div className="choice-list">
                    {(q.options ?? []).map((opt, j) => (
                      <label key={j} className="choice-option">
                        <input type="radio" name={`q_${q.id}`} value={opt} required />
                        <span>{opt}</span>
                      </label>
                    ))}
                    {/* "Outro": marca o rádio e escreve o próprio texto. */}
                    <label className="choice-option choice-other-row">
                      <input type="radio" name={`q_${q.id}`} value={OTHER_VALUE} />
                      <span>Outro:</span>
                      <Input
                        type="text"
                        name={`q_${q.id}__other`}
                        className="choice-other"
                        placeholder="Escreva sua resposta"
                      />
                    </label>
                  </div>
                )}
              </fieldset>
            ))}
          </div>
        ) : null}

        <div className="consent-box">
          <p className="consent-text">{consentText}</p>
        </div>

        <label className="consent-check">
          <input type="checkbox" name="consent" />
          <span>Li e aceito o termo de consentimento acima.</span>
        </label>

        {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

        <div className="consent-actions">
          <Button type="submit" loading={pending} loadingText="Concluindo…">
            Concluir onboarding
          </Button>
        </div>
      </form>

      {/* Abandonar: apaga a linha pendente e devolve o convite para pendente. Form
          separado para não arrastar a validação/pending do consentimento. */}
      <form action={abandonOnboarding} className="consent-abandon">
        <input type="hidden" name="project_id" value={projectId} />
        <SubmitButton variant="danger" pendingText="Abandonando…">
          Abandonar
        </SubmitButton>
      </form>
    </>
  )
}
