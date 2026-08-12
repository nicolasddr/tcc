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
import { Choice, Fieldset, Input, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Card } from '@/app/components/ui/card'
import { Alert } from '@/app/components/ui/alert'
import { ANSWER_MAX } from '@/lib/limits'

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
      <Form action={action} gap="sm">
        <input type="hidden" name="project_id" value={projectId} />

        {/* Perguntas de onboarding (HU-028/032): todas obrigatórias. */}
        {questions.length > 0 ? (
          <div className="flex flex-col gap-5">
            {questions.map((q, i) => (
              <Fieldset
                key={q.id}
                legend={
                  <>
                    {i + 1}. {q.questionText}
                  </>
                }
              >
                {q.questionType === 'open' ? (
                  <Textarea
                    name={`q_${q.id}`}
                    rows={2}
                    required
                    maxLength={ANSWER_MAX}
                    placeholder="Sua resposta"
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {(q.options ?? []).map((opt, j) => (
                      <Choice
                        key={j}
                        type="radio"
                        name={`q_${q.id}`}
                        value={opt}
                        required
                      >
                        <span>{opt}</span>
                      </Choice>
                    ))}
                    {/* "Outro": marca o rádio e escreve o próprio texto. */}
                    <Choice
                      type="radio"
                      name={`q_${q.id}`}
                      value={OTHER_VALUE}
                      className="flex-wrap"
                    >
                      <span>Outro:</span>
                      <Input
                        type="text"
                        name={`q_${q.id}__other`}
                        maxLength={ANSWER_MAX}
                        className="min-w-0 flex-1 basis-[200px]"
                        placeholder="Escreva sua resposta"
                      />
                    </Choice>
                  </div>
                )}
              </Fieldset>
            ))}
          </div>
        ) : null}

        <Card tone="subtle" padding="lg">
          <p className="m-0 text-sm leading-[1.7] text-ink-soft">{consentText}</p>
        </Card>

        <Choice type="checkbox" name="consent" align="start">
          <span>Li e aceito o termo de consentimento acima.</span>
        </Choice>

        {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

        <FormActions align="start">
          <Button type="submit" loading={pending} loadingText="Concluindo…">
            Concluir onboarding
          </Button>
        </FormActions>
      </Form>

      {/* Abandonar: apaga a linha pendente e devolve o convite para pendente. Form
          separado para não arrastar a validação/pending do consentimento. */}
      <form action={abandonOnboarding} className="mt-5 border-t border-line pt-4">
        <input type="hidden" name="project_id" value={projectId} />
        <SubmitButton variant="danger" pendingText="Abandonando…">
          Abandonar
        </SubmitButton>
      </form>
    </>
  )
}
