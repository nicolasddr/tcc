'use client'

import { startTransition, useActionState, useState } from 'react'
import { savePrompt, type PromptState } from './actions'
import type { PromptVersion } from './prompt'
import { Button, buttonClass } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { Panel } from '@/app/components/ui/panel'
import { Field, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Alert } from '@/app/components/ui/alert'
import { EmptyState } from '@/app/components/ui/empty-state'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { preWrapClass } from '@/app/components/ui/prose'
import { plural } from '@/lib/plural'
import { NO_VERSION_EXPLANATION, versionExplanation } from './version-status'
import { PROMPT_TEXT_MAX } from '@/lib/limits'

const initialState: PromptState = null

const textClass =
  'max-h-[60vh] min-h-[220px] overflow-auto font-mono text-[13px] leading-[1.6]'

const SCREEN_EXPLANATION =
  'A instrução enviada à LLM, versionada de forma independente do codebook.'

const TEXT_HINT =
  'A instrução vai à LLM exatamente como está escrita aqui: quebras de linha, linhas em branco e recuos são preservados.'

function counterLabel(length: number): string {
  return `${length} / ${PROMPT_TEXT_MAX}`
}

function TextFrame({
  counter,
  footer,
  children,
}: {
  counter: React.ReactNode
  footer: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
        <span className="text-[13px] font-semibold text-ink">Texto enviado à LLM</span>
        <span className="text-xs tabular-nums text-muted">{counter}</span>
      </div>

      <div className="pt-3">{children}</div>

      <p className="m-0 mt-3 border-t border-line pt-2 text-xs text-muted">{footer}</p>
    </Card>
  )
}

export function PromptEditor({
  projectId,
  version,
  isOpen,
  definitions,
  items,
  historyAnchor,
}: {
  projectId: string
  version: PromptVersion | null
  isOpen: boolean
  definitions: number
  items: number
  historyAnchor: string
}) {
  const [state, submit, pending] = useActionState(savePrompt, initialState)
  const [text, setText] = useState(version?.text ?? '')

  const saved = state !== null && 'ok' in state
  const savedNonce = saved ? state.nonce : 0
  const [editingNonce, setEditingNonce] = useState<number | null>(null)
  const editing = editingNonce === savedNonce

  function edit() {
    setText(version?.text ?? '')
    setEditingNonce(savedNonce)
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => submit(data))
  }

  const composition = (
    <>
      Na chamada real seguem junto:{' '}
      {plural(definitions, 'título de definição', 'títulos de definição')} + 1 item de
      entrada, escolhido entre os {plural(items, 'item', 'itens')} do pool.
    </>
  )

  return (
    <Panel
      title={
        <>
          Prompt
          <span className="text-[13px] font-normal text-muted">
            {version
              ? `· versão ${version.versionNumber}${version.name ? ` · «${version.name}»` : ''}`
              : '· nenhuma versão ainda'}
          </span>
          {version ? (
            <Badge tone={isOpen ? 'info' : 'neutral'}>
              {isOpen ? 'em aberto' : 'congelada'}
            </Badge>
          ) : null}
          <InfoTooltip
            text={`${SCREEN_EXPLANATION}\n\n${
              version
                ? versionExplanation(version.versionNumber, isOpen)
                : NO_VERSION_EXPLANATION
            }`}
          />
        </>
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`#${historyAnchor}`}
            className={buttonClass('secondary', { size: 'sm' })}
          >
            Histórico
          </a>
          {editing ? null : (
            <Button size="sm" onClick={edit}>
              {version ? 'Editar texto' : 'Escrever o prompt'}
            </Button>
          )}
        </div>
      }
    >
      {editing ? (
        <Form onSubmit={onSubmit} gap="sm">
          <input type="hidden" name="project_id" value={projectId} />
          {version ? <input type="hidden" name="version_id" value={version.id} /> : null}

          <Field
            label={
              <>
                Texto do prompt{' '}
                <span className="font-normal tabular-nums text-muted">
                  · {counterLabel(text.length)}
                </span>
              </>
            }
            required
            hint={TEXT_HINT}
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

          <p className="m-0 text-xs text-muted">{composition}</p>

          {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

          <FormActions align="start">
            <Button
              type="submit"
              disabled={text.trim().length === 0}
              loading={pending}
              loadingText="Salvando…"
            >
              Salvar prompt
            </Button>
            <Button variant="secondary" onClick={() => setEditingNonce(null)}>
              Voltar à leitura
            </Button>
          </FormActions>
        </Form>
      ) : (
        <div className="flex flex-col gap-3">
          {saved ? <Alert tone="success">Prompt salvo.</Alert> : null}

          {version ? (
            <TextFrame counter={counterLabel(version.text.length)} footer={composition}>
              <p className={`m-0 ${textClass} ${preWrapClass} text-ink`}>
                {version.text}
              </p>
            </TextFrame>
          ) : (
            <EmptyState>
              Nenhum texto de prompt ainda. {TEXT_HINT}
            </EmptyState>
          )}
        </div>
      )}
    </Panel>
  )
}
