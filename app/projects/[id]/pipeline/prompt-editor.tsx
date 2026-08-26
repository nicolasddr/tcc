'use client'

import { startTransition, useActionState, useState } from 'react'
import { savePrompt, type PromptState } from './actions'
import type { PromptVersion } from './prompt'
import { Button } from '@/app/components/ui/button'
import { Field, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Card } from '@/app/components/ui/card'
import { Alert } from '@/app/components/ui/alert'
import { EmptyState } from '@/app/components/ui/empty-state'
import { VersionStatus } from './version-status'
import { PROMPT_TEXT_MAX } from '@/lib/limits'

const initialState: PromptState = null

const textClass =
  'max-h-[60vh] min-h-[220px] overflow-auto font-mono text-[13px] leading-[1.6]'

function FrozenPrompt({ text }: { text: string }) {
  return (
    <Card padding="sm">
      <p className={`m-0 ${textClass} whitespace-pre-wrap break-words text-ink`}>{text}</p>
    </Card>
  )
}

export function PromptEditor({
  projectId,
  version,
  isOpen,
}: {
  projectId: string
  version: PromptVersion | null
  isOpen: boolean
}) {
  const [state, submit, pending] = useActionState(savePrompt, initialState)
  const [text, setText] = useState(version?.text ?? '')

  if (!isOpen) {
    return (
      <div className="flex flex-col gap-4">
        <VersionStatus version={version} isOpen={isOpen} />
        {version && version.text ? (
          <FrozenPrompt text={version.text} />
        ) : (
          <EmptyState>Esta versão não tem texto de prompt.</EmptyState>
        )}
      </div>
    )
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => submit(data))
  }

  return (
    <div className="flex flex-col gap-4">
      <VersionStatus version={version} isOpen={isOpen} />

      <Form onSubmit={onSubmit} gap="sm">
        <input type="hidden" name="project_id" value={projectId} />
        {version ? <input type="hidden" name="version_id" value={version.id} /> : null}

        <Field
          label="Texto do prompt"
          required
          hint="A instrução vai à LLM exatamente como está escrita aqui: quebras de linha, linhas em branco e recuos são preservados."
        >
          <Textarea
            name="text"
            required
            rows={12}
            maxLength={PROMPT_TEXT_MAX}
            className={textClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: Classifique a consulta de busca abaixo em uma das categorias do codebook."
          />
        </Field>

        {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
        {state && 'ok' in state ? <Alert tone="success">Prompt salvo.</Alert> : null}

        <FormActions>
          <Button
            type="submit"
            disabled={text.trim().length === 0}
            loading={pending}
            loadingText="Salvando…"
          >
            Salvar prompt
          </Button>
        </FormActions>
      </Form>
    </div>
  )
}
