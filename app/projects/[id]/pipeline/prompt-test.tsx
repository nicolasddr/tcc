'use client'

import { useActionState } from 'react'
import { testPrompt, type PromptTestState } from './actions'
import type { InputItem } from './items'
import { Button } from '@/app/components/ui/button'
import { Field, Select } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Card } from '@/app/components/ui/card'
import { Alert } from '@/app/components/ui/alert'
import { EmptyState } from '@/app/components/ui/empty-state'

const initialState: PromptTestState = null

const outputClass =
  'max-h-[60vh] min-h-[120px] overflow-auto font-mono text-[13px] leading-[1.6]'

export function PromptTest({
  projectId,
  items,
  model,
  ready,
}: {
  projectId: string
  items: InputItem[]
  model: string
  ready: boolean
}) {
  const [state, action, pending] = useActionState(testPrompt, initialState)

  if (!ready) {
    return (
      <EmptyState>
        O teste fica disponível quando houver ao menos uma definição, o texto do prompt e
        um item de entrada.
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Form action={action} gap="sm">
        <input type="hidden" name="project_id" value={projectId} />

        <Field
          label="Item de entrada do teste"
          required
          hint="Vão à LLM o texto do prompt vigente, os títulos das definições da versão vigente e o conteúdo deste item."
        >
          <Select name="item_id" required defaultValue={items[0]?.id}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

        <FormActions align="start">
          <Button type="submit" loading={pending} loadingText="Consultando a LLM…">
            Testar o prompt
          </Button>
          <span className="text-[13px] text-muted">Modelo: {model}</span>
        </FormActions>
      </Form>

      {state && 'ok' in state ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[13px] font-semibold text-ink">
            Resposta da LLM ({state.model})
          </p>
          <Card padding="sm">
            <p
              className={`m-0 ${outputClass} whitespace-pre-wrap break-words text-ink`}
            >
              {state.output}
            </p>
          </Card>
          <p className="m-0 text-[13px] text-muted">
            Nada disso é gravado: o resultado some ao sair da tela, e nenhuma versão
            congela por causa do teste.
          </p>
        </div>
      ) : null}
    </div>
  )
}
