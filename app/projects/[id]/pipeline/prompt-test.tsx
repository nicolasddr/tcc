'use client'

import { useActionState, useEffect, useRef } from 'react'
import { testPrompt, type PromptTestState } from './actions'
import type { InputItem } from './items'
import { Button } from '@/app/components/ui/button'
import { Field, Select } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Card } from '@/app/components/ui/card'
import { preWrapClass } from '@/app/components/ui/prose'
import { Alert } from '@/app/components/ui/alert'
import { EmptyState } from '@/app/components/ui/empty-state'
import { SentInput } from '../(tabs)/rounds/sent-input'
import { PHASE_3 } from './preconditions'

const initialState: PromptTestState = null

const outputClass =
  'max-h-[60vh] min-h-[120px] overflow-auto font-mono text-[13px] leading-[1.6]'

type PromptTestAnswer = Extract<PromptTestState, { ok: true }>

export function promptTestHint(phase: number): string {
  if (phase >= PHASE_3) {
    return 'Vão à LLM o texto do prompt vigente, o codebook completo da versão vigente (títulos, descrições e critérios) e o conteúdo deste item, como numa rodada desta fase.'
  }
  return 'Vão à LLM o texto do prompt vigente, os títulos das definições da versão vigente e o conteúdo deste item.'
}

export function PromptTestResult({
  answer,
  pending,
}: {
  answer: PromptTestAnswer
  pending: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-2 ${pending ? 'opacity-60' : ''}`}
      aria-busy={pending || undefined}
    >
      <SentInput sentInput={answer.input} />
      <p className="m-0 text-[13px] font-semibold text-ink">
        {pending
          ? `Resposta do teste anterior (${answer.model})`
          : `Resposta da LLM (${answer.model})`}
      </p>
      <Card padding="sm" tone="subtle">
        <p className={`m-0 ${outputClass} ${preWrapClass} text-ink`}>{answer.output}</p>
      </Card>
      <p className="m-0 text-[13px] text-muted">
        Nada disso é gravado: o resultado some ao sair da tela, e nenhuma versão congela
        por causa do teste.
      </p>
    </div>
  )
}

export function PromptTest({
  projectId,
  items,
  model,
  ready,
  phase,
}: {
  projectId: string
  items: InputItem[]
  model: string
  ready: boolean
  phase: number
}) {
  const [state, action, pending] = useActionState(testPrompt, initialState)
  const running = useRef(false)

  useEffect(() => {
    if (!pending) running.current = false
  }, [pending])

  if (!ready) {
    return (
      <EmptyState>
        O teste fica disponível quando houver ao menos uma definição, o texto do prompt e
        um item de entrada.
      </EmptyState>
    )
  }

  const error = state && 'error' in state ? state.error : null
  const answer = state && 'ok' in state ? state : null

  return (
    <div className="flex flex-col gap-4">
      <Form
        action={action}
        gap="sm"
        onSubmit={(event) => {
          if (pending || running.current) {
            event.preventDefault()
            return
          }
          running.current = true
        }}
      >
        <input type="hidden" name="project_id" value={projectId} />

        <Field label="Item de entrada do teste" required hint={promptTestHint(phase)}>
          <Select name="item_id" required defaultValue={items[0]?.id}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        {error && !pending ? <Alert tone="error">{error}</Alert> : null}

        <FormActions align="start">
          <Button
            type="submit"
            variant="secondary"
            loading={pending}
            loadingText="Consultando a LLM…"
          >
            Testar o prompt
          </Button>
          <span className="text-[13px] text-muted">Modelo: {model}</span>
        </FormActions>

        {pending ? (
          <p role="status" aria-live="polite" className="m-0 text-[13px] text-muted">
            Consultando a LLM… a resposta pode levar alguns segundos, e a tela continua
            utilizável enquanto ela não chega.
          </p>
        ) : null}
      </Form>

      {answer ? <PromptTestResult answer={answer} pending={pending} /> : null}
    </div>
  )
}
