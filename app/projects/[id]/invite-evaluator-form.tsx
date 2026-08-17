'use client'

import { useActionState, useEffect, useRef } from 'react'
import { inviteEvaluator, type InviteEvaluatorState } from '@/app/projects/actions'
import { Button } from '@/app/components/ui/button'
import { Field, Input } from '@/app/components/ui/field'
import { Form } from '@/app/components/ui/form'
import { Alert } from '@/app/components/ui/alert'
import { EMAIL_MAX } from '@/lib/limits'

const initialState: InviteEvaluatorState = null

export function InviteEvaluatorForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(inviteEvaluator, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Limpa o e-mail após um convite bem-sucedido para facilitar convidar o próximo.
  useEffect(() => {
    if (state && 'ok' in state) formRef.current?.reset()
  }, [state])

  return (
    <Form ref={formRef} action={action} gap="sm">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="E-mail do avaliador" className="min-w-[220px] flex-1">
          <Input
            type="email"
            name="email"
            required
            maxLength={EMAIL_MAX}
            autoComplete="off"
            placeholder="avaliador@exemplo.com"
          />
        </Field>
        <Button type="submit" loading={pending} loadingText="Convidando…">
          Convidar
        </Button>
      </div>

      <p className="text-xs text-muted">
        Pode convidar mesmo quem ainda não tem conta: o convite aparece no primeiro
        acesso com o Google.
      </p>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? <Alert tone="success">{state.ok}</Alert> : null}
    </Form>
  )
}
