'use client'

import { startTransition, useActionState } from 'react'
import { savePromptMetadata, type PromptMetadataState } from './actions'
import type { PromptVersion } from './prompt'
import { Button } from '@/app/components/ui/button'
import { Field, Input, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Alert } from '@/app/components/ui/alert'
import { EmptyState } from '@/app/components/ui/empty-state'
import {
  PROMPT_CHANGE_LOG_MAX,
  PROMPT_DESCRIPTION_MAX,
  PROMPT_NAME_MAX,
} from '@/lib/limits'

const initialState: PromptMetadataState = null

export function PromptMetadataEditor({
  projectId,
  version,
}: {
  projectId: string
  version: PromptVersion | null
}) {
  const [state, submit, pending] = useActionState(savePromptMetadata, initialState)

  if (!version) {
    return (
      <EmptyState>
        Nome, descrição e registro de mudanças ficam disponíveis assim que o texto do
        prompt criar a versão 1.
      </EmptyState>
    )
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => submit(data))
  }

  return (
    <Form onSubmit={onSubmit} gap="sm">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="version_id" value={version.id} />

      <Field
        label="Nome desta versão (opcional)"
        hint="Um apelido curto para a equipe reconhecer a versão no histórico."
      >
        <Input
          type="text"
          name="name"
          maxLength={PROMPT_NAME_MAX}
          defaultValue={version.name ?? ''}
          placeholder="Ex.: instrução direta, sem exemplos"
        />
      </Field>

      <Field
        label="Descrição (opcional)"
        hint="O que esta versão do prompt pretende fazer."
      >
        <Textarea
          name="description"
          rows={3}
          maxLength={PROMPT_DESCRIPTION_MAX}
          defaultValue={version.description ?? ''}
          placeholder="Ex.: pede a categoria e uma justificativa de uma linha."
        />
      </Field>

      <Field
        label="Registro de mudanças (opcional)"
        hint="O que mudou em relação à versão anterior, e por quê."
      >
        <Textarea
          name="change_log"
          rows={3}
          maxLength={PROMPT_CHANGE_LOG_MAX}
          defaultValue={version.changeLog ?? ''}
          placeholder="Ex.: passei a pedir a justificativa depois da categoria."
        />
      </Field>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? (
        <Alert tone="success">Dados do prompt salvos, sem criar versão nova.</Alert>
      ) : null}

      <FormActions>
        <Button
          type="submit"
          variant="secondary"
          loading={pending}
          loadingText="Salvando…"
        >
          Salvar dados do prompt
        </Button>
      </FormActions>
    </Form>
  )
}
