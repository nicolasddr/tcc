'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import { savePrompt, type PromptState } from './actions'
import { isEditing, savedNonceOf } from './editing'
import type { PromptVersion } from './prompt'
import { Button, buttonClass } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { Panel } from '@/app/components/ui/panel'
import { Field, Textarea } from '@/app/components/ui/field'
import { Form } from '@/app/components/ui/form'
import { Alert } from '@/app/components/ui/alert'
import { FrozenNotice } from './frozen-notice'
import { EmptyState } from '@/app/components/ui/empty-state'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { SaveBar } from '@/app/components/ui/save-bar'
import { preWrapClass } from '@/app/components/ui/prose'
import { plural } from '@/lib/plural'
import { NO_VERSION_EXPLANATION, versionExplanation } from './version-status'
import { PROMPT_TEXT_MAX } from '@/lib/limits'
import { PHASE_3 } from './preconditions'

const initialState: PromptState = null

const textClass =
  'max-h-[60vh] min-h-[220px] overflow-auto font-mono text-[13px] leading-[1.6]'

const SCREEN_EXPLANATION =
  'A instrução enviada à LLM, versionada de forma independente do codebook.'

const TEXT_HINT =
  'A instrução vai à LLM exatamente como está escrita aqui: quebras de linha, linhas em branco e recuos são preservados.'

export function promptComposition(
  phase: number,
  definitions: number,
  items: number,
): string {
  const pool = `1 item de entrada, escolhido entre os ${plural(items, 'item', 'itens')} do pool`
  if (phase >= PHASE_3) {
    return `Na chamada real seguem junto: o codebook completo da versão vigente (${plural(definitions, 'definição', 'definições')}, com títulos, descrições e critérios) + ${pool}.`
  }
  return `Na chamada real seguem junto: ${plural(definitions, 'título de definição', 'títulos de definição')} + ${pool}.`
}

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

export function PromptForm({
  projectId,
  version,
  composition,
  error,
  pending,
  onSubmit,
  onDone,
}: {
  projectId: string
  version: PromptVersion | null
  composition: string
  error: string | null
  pending: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onDone: () => void
}) {
  const [text, setText] = useState(version?.text ?? '')
  const dirty = text !== (version?.text ?? '')

  useEffect(() => {
    if (!dirty) return
    function warnOnLeave(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnOnLeave)
    return () => window.removeEventListener('beforeunload', warnOnLeave)
  }, [dirty])

  return (
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

      {error !== null ? <Alert tone="error">{error}</Alert> : null}

      <SaveBar
        dirty={dirty}
        changes="Texto do prompt alterado."
        onDiscard={onDone}
        canSave={text.trim().length > 0}
        loading={pending}
        loadingText="Salvando…"
      />
    </Form>
  )
}

export function PromptEditor({
  projectId,
  version,
  isOpen,
  phase,
  definitions,
  items,
  historyAnchor,
  frozen,
}: {
  projectId: string
  version: PromptVersion | null
  isOpen: boolean
  phase: number
  definitions: number
  items: number
  historyAnchor?: string
  frozen: boolean
}) {
  const [state, submit, pending] = useActionState(savePrompt, initialState)

  const saved = state !== null && 'ok' in state
  const [editingNonce, setEditingNonce] = useState<number | null>(null)
  const editing = !frozen && isEditing(state, editingNonce)

  function edit() {
    setEditingNonce(savedNonceOf(state))
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => submit(data))
  }

  const composition = promptComposition(phase, definitions, items)

  return (
    <Panel
      title={
        <>
          Prompt
          <InfoTooltip text={SCREEN_EXPLANATION} label="Sobre o prompt" />
          <span className="text-[13px] font-normal text-muted">
            {version
              ? `· versão ${version.versionNumber}${version.name ? ` · «${version.name}»` : ''}`
              : '· nenhuma versão ainda'}
          </span>
          {version ? (
            <Badge tone={isOpen ? 'info' : 'neutral'}>
              {isOpen ? 'Em aberto' : 'Congelada'}
            </Badge>
          ) : null}
          <InfoTooltip
            text={
              version
                ? versionExplanation(version.versionNumber, isOpen)
                : NO_VERSION_EXPLANATION
            }
            label="Sobre a versão"
          />
        </>
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          {historyAnchor ? (
            <a
              href={`#${historyAnchor}`}
              className={buttonClass('secondary', { size: 'sm' })}
            >
              Histórico
            </a>
          ) : null}
          {editing || frozen ? null : (
            <Button variant="secondary" size="sm" onClick={edit}>
              {version ? 'Editar' : 'Escrever o prompt'}
            </Button>
          )}
        </div>
      }
    >
      {editing ? (
        <PromptForm
          projectId={projectId}
          version={version}
          composition={composition}
          error={state && 'error' in state ? state.error : null}
          pending={pending}
          onSubmit={onSubmit}
          onDone={() => setEditingNonce(null)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {saved ? <Alert tone="success">Prompt salvo.</Alert> : null}
          {frozen ? <FrozenNotice subject="prompt" projectId={projectId} /> : null}

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
