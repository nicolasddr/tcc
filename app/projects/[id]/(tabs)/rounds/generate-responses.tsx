'use client'

import { useActionState, useRef, useState } from 'react'
import { generateResponses, type GenerateResponsesState } from './actions'
import {
  SELECTION_MAX,
  ceilingReachedMessage,
  generatedCountMessage,
  generationFailureMessage,
  generationMax,
  responsesLeftMessage,
  retryLabel,
  selectionBlockerMessage,
  selectionBlockers,
} from './preconditions'
import type { InputItem } from '../../pipeline/items'
import type { RoundResponse } from '../../pipeline/responses'
import { itemPreview } from '../../pipeline/item-preview'
import { itemUsageLabel } from '../../pipeline/item-usage'
import { formatDate } from '@/app/notifications/labels'
import { Alert } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Form, FormActions } from '@/app/components/ui/form'

const initialState: GenerateResponsesState = null

export function GenerateResponses({
  projectId,
  round,
  items,
  generated,
  model,
  responsesLeft,
  responsesMax,
}: {
  projectId: string
  round: { id: string; roundNumber: number }
  items: InputItem[]
  generated: RoundResponse[]
  model: string
  responsesLeft: number
  responsesMax: number
}) {
  const [state, action, pending] = useActionState(generateResponses, initialState)
  const [selected, setSelected] = useState<string[]>([])
  const [settled, setSettled] = useState<number | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const done = state && 'ok' in state ? state.nonce : null
  if (done !== settled) {
    setSettled(done)
    setSelected([])
  }

  const usedInRound = generated.map((response) => response.itemId)
  const usedHere = new Set(usedInRound)
  const available = items.filter((item) => !usedHere.has(item.id))

  const max = generationMax(responsesLeft)
  const outOfQuota = responsesLeft === 0

  const blockers = selectionBlockers(selected, {
    available: items.map((item) => item.id),
    usedInRound,
    responsesLeft,
  })
  const complaint = blockers.find((blocker) => blocker.key !== 'empty')
  const atMax = selected.length >= max

  const atMaxNote =
    max < SELECTION_MAX
      ? `Restam ${max} ${max === 1 ? 'vaga' : 'vagas'} de resposta de LLM neste ` +
        'projeto, e cada item selecionado gasta uma.'
      : `Máximo de ${SELECTION_MAX} itens por geração. Gere estes e selecione os ` +
        'próximos depois.'

  function toggle(itemId: string, checked: boolean) {
    setSelected((current) =>
      checked
        ? current.includes(itemId)
          ? current
          : [...current, itemId]
        : current.filter((id) => id !== itemId),
    )
  }

  const error = state && 'error' in state ? state.error : null
  const outcome = state && 'ok' in state ? state : null
  const nameOf = (itemId: string) =>
    items.find((item) => item.id === itemId)?.name ?? 'Item removido'

  const retryable = (outcome?.failed ?? [])
    .map((failure) => failure.itemId)
    .filter((itemId) => available.some((item) => item.id === itemId))
  const retryTargets = retryable.slice(0, max)

  function retryFailed() {
    setSelected(retryTargets)
    formRef.current?.scrollIntoView({ block: 'start' })
  }

  if (items.length === 0) {
    return (
      <EmptyState>
        Este projeto ainda não tem item de entrada, e cada item selecionado é uma resposta
        a gerar. Cadastre ao menos um item na aba Itens.
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Form action={action} gap="sm" ref={formRef}>
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="round_id" value={round.id} />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="m-0 text-[13px] font-semibold text-ink">
            {selected.length} de {max}{' '}
            {max === 1 ? 'item selecionado' : 'itens selecionados'}
          </p>
          <p className="m-0 text-[13px] text-muted">
            {responsesLeftMessage(responsesLeft, responsesMax)}
          </p>
        </div>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((item) => {
            const used = usedHere.has(item.id)
            const checked = selected.includes(item.id)
            const label = itemUsageLabel(item.roundNumbers)

            return (
              <li key={item.id}>
                <Card padding="sm" tone={used ? 'subtle' : 'default'}>
                  <label
                    className={`flex gap-2.5 ${used ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      name="item_ids"
                      value={item.id}
                      checked={checked}
                      disabled={used || pending || outOfQuota || (atMax && !checked)}
                      onChange={(event) => toggle(item.id, event.target.checked)}
                      className="mt-[3px] h-4 w-4 shrink-0 accent-brand"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span
                          className={`text-sm font-semibold ${used ? 'text-muted' : 'text-ink'}`}
                        >
                          {item.name}
                        </span>
                        {used ? (
                          <Badge tone="info">já respondido nesta rodada</Badge>
                        ) : label ? (
                          <Badge tone="neutral">{label}</Badge>
                        ) : null}
                      </span>
                      <span className="text-[13px] break-words text-muted">
                        {itemPreview(item.content)}
                      </span>
                    </span>
                  </label>
                </Card>
              </li>
            )
          })}
        </ul>

        {available.length === 0 ? (
          <p className="m-0 text-[13px] text-muted">
            Todos os itens do projeto já produziram resposta na rodada{' '}
            {round.roundNumber}. Cadastre outro item, ou use estes de novo na próxima
            rodada.
          </p>
        ) : null}

        {atMax && !outOfQuota ? (
          <p className="m-0 text-[13px] text-muted">{atMaxNote}</p>
        ) : null}

        {outOfQuota ? (
          <Alert tone="notice">{ceilingReachedMessage(responsesMax)}</Alert>
        ) : null}

        {complaint ? (
          <Alert tone="notice">{selectionBlockerMessage(complaint)}</Alert>
        ) : null}
        {error && !pending ? <Alert tone="error">{error}</Alert> : null}

        <FormActions align="start">
          <Button
            type="submit"
            loading={pending}
            loadingText="Gerando…"
            disabled={blockers.length > 0 || outOfQuota}
          >
            Gerar respostas
          </Button>
          <span className="text-[13px] text-muted">Modelo: {model}</span>
        </FormActions>

        {pending ? (
          <p role="status" aria-live="polite" className="m-0 text-[13px] text-muted">
            Gerando… cada item é uma chamada à LLM, e o que der certo é gravado mesmo que
            outro item falhe.
          </p>
        ) : null}
      </Form>

      {outcome && outcome.created.length > 0 && !pending ? (
        <Alert tone="success">{generatedCountMessage(outcome.created.length)}</Alert>
      ) : null}

      {outcome && outcome.failed.length > 0 && !pending ? (
        <Card tone="subtle" padding="sm">
          <p className="m-0 text-[13px] font-semibold text-ink">
            {outcome.failed.length === 1
              ? 'Um item não gerou resposta:'
              : `${outcome.failed.length} itens não geraram resposta:`}
          </p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {outcome.failed.map((failure) => (
              <li key={failure.itemId} className="text-[13px] text-muted">
                <span className="font-semibold text-ink">{nameOf(failure.itemId)}</span>{' '}
                {generationFailureMessage(failure.failure)}
              </li>
            ))}
          </ul>

          {retryTargets.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Button type="button" variant="secondary" size="sm" onClick={retryFailed}>
                {retryLabel(retryTargets.length)}
              </Button>
              {retryTargets.length < retryable.length ? (
                <span className="text-[13px] text-muted">
                  Só cabem {retryTargets.length} de {retryable.length} nesta geração; os
                  demais ficam para a próxima.
                </span>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="m-0 text-[13px] font-semibold text-ink">
          Respostas da rodada {round.roundNumber}
        </p>
        {generated.length === 0 ? (
          <p className="m-0 text-[13px] text-muted">
            Nenhuma resposta gerada nesta rodada ainda.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {generated.map((response) => (
              <li
                key={response.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]"
              >
                <span className="font-semibold text-ink">{response.itemName}</span>
                <span className="text-muted">{formatDate(response.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
