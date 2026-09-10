'use client'

import { useActionState, useState } from 'react'
import { createItem, updateItem, deleteItem, type ItemState } from './actions'
import type { InputItem } from './items'
import { itemPreview } from './item-preview'
import { itemUsageLabel } from './item-usage'
import { Button } from '@/app/components/ui/button'
import { RowActions, RowMenuItem } from '@/app/components/ui/row-actions'
import { Field, Input, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Alert } from '@/app/components/ui/alert'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Section } from '@/app/components/ui/section'
import { ITEM_CONTENT_MAX, ITEM_NAME_MAX } from '@/lib/limits'
import {
  readItemFile,
  ITEM_FILE_LIMIT_LABEL,
  TEXT_FILE_ACCEPT,
  TEXT_FILE_EXAMPLES,
} from './item-content'

const initialState: ItemState = null

const contentClass =
  'max-h-[50vh] min-h-[180px] overflow-auto font-mono text-[13px] leading-[1.6]'

const fileInputClass =
  'w-full cursor-pointer rounded-control border border-line-strong bg-surface px-[11px] py-[9px] ' +
  'text-sm text-muted outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring ' +
  'disabled:cursor-default disabled:bg-surface-subtle ' +
  'file:mr-3 file:cursor-pointer file:rounded-control file:border file:border-line-strong ' +
  'file:bg-canvas file:px-3 file:py-[5px] file:text-xs file:font-semibold file:text-label'

const fileHint =
  `Formatos de texto (${TEXT_FILE_EXAMPLES}) e arquivos de código, até ${ITEM_FILE_LIMIT_LABEL}. ` +
  'O conteúdo entra no campo abaixo e continua editável; o arquivo em si não é guardado.'

function ItemFields({ name, content }: { name?: string; content?: string }) {
  const [text, setText] = useState(content ?? '')
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setFileError(null)
    setReading(true)
    const result = await readItemFile(file)
    setReading(false)

    if ('error' in result) {
      setFileError(result.error)
      return
    }
    setText(result.text)
  }

  return (
    <>
      <Field label="Nome do item" required>
        <Input
          type="text"
          name="name"
          required
          maxLength={ITEM_NAME_MAX}
          defaultValue={name}
          placeholder="Ex.: Consulta 001"
        />
      </Field>

      <Field
        label="Carregar de um arquivo"
        hint={reading ? 'Lendo o arquivo…' : fileHint}
        error={fileError}
      >
        <input
          type="file"
          accept={TEXT_FILE_ACCEPT}
          disabled={reading}
          onChange={onFileChange}
          className={fileInputClass}
        />
      </Field>

      <Field
        label="Conteúdo"
        required
        hint="O conteúdo vai à LLM exatamente como está escrito aqui: quebras de linha, linhas em branco e recuos são preservados."
      >
        <Textarea
          name="content"
          required
          rows={8}
          maxLength={ITEM_CONTENT_MAX}
          className={contentClass}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Cole aqui o texto que a LLM vai processar, ou carregue de um arquivo acima."
        />
      </Field>
    </>
  )
}

function NewItemForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(createItem, initialState)
  const fieldsKey = state && 'ok' in state ? state.nonce : 'idle'

  return (
    <Form action={action} gap="sm">
      <input type="hidden" name="project_id" value={projectId} />
      <ItemFields key={fieldsKey} />

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? <Alert tone="success">Item cadastrado.</Alert> : null}

      <FormActions>
        <Button type="submit" loading={pending} loadingText="Cadastrando…">
          Cadastrar item
        </Button>
      </FormActions>
    </Form>
  )
}

function EditItemForm({
  projectId,
  item,
  onDone,
}: {
  projectId: string
  item: InputItem
  onDone: () => void
}) {
  const [state, action, pending] = useActionState(updateItem, initialState)

  return (
    <Form action={action} gap="sm">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="item_id" value={item.id} />
      <ItemFields name={item.name} content={item.content} />

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? <Alert tone="success">Item atualizado.</Alert> : null}

      <FormActions align="start">
        <Button type="submit" loading={pending} loadingText="Salvando…">
          Salvar item
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Concluir edição
        </Button>
      </FormActions>
    </Form>
  )
}

function ItemRowActions({ projectId, item }: { projectId: string; item: InputItem }) {
  const [state, action, pending] = useActionState(deleteItem, initialState)

  return (
    <>
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(`Remover o item “${item.name}”? O conteúdo dele é apagado.`)) {
            e.preventDefault()
          }
        }}
      >
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="item_id" value={item.id} />
        <RowActions menuLabel={`Mais ações do item ${item.name}`}>
          <RowMenuItem type="submit" disabled={pending} aria-busy={pending || undefined}>
            {pending ? 'Removendo…' : 'Remover'}
          </RowMenuItem>
        </RowActions>
      </form>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
    </>
  )
}

function ItemCard({ projectId, item }: { projectId: string; item: InputItem }) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-sm font-semibold text-ink">{item.name}</span>
        {item.isEditable && item.roundNumbers.length === 0 ? null : (
          <Badge tone="neutral">{itemUsageLabel(item.roundNumbers) ?? 'usado em rodada'}</Badge>
        )}
      </div>

      {editing ? (
        <div className="mt-3.5">
          <EditItemForm
            projectId={projectId}
            item={item}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          <p className="m-0 mt-1.5 text-[13px] break-words text-muted">
            {itemPreview(item.content)}
          </p>

          {expanded ? (
            <Card tone="subtle" padding="sm" className="mt-3">
              <p
                className={`m-0 ${contentClass} whitespace-pre-wrap break-words text-ink`}
              >
                {item.content}
              </p>
            </Card>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Button variant="quiet" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Ocultar conteúdo' : 'Ver conteúdo completo'}
            </Button>

            {item.isEditable ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Editar
                </Button>
                <ItemRowActions projectId={projectId} item={item} />
              </div>
            ) : (
              <span className="text-[13px] text-muted">
                Já usado em uma rodada: editar ou remover mudaria o que os avaliadores
                viram, então este item não muda mais.
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

export function ItemsEditor({
  projectId,
  items,
}: {
  projectId: string
  items: InputItem[]
}) {
  return (
    <div>
      <p className="m-0 mb-3 text-[13px] font-semibold text-ink">
        {items.length === 1 ? '1 item no projeto' : `${items.length} itens no projeto`}
      </p>

      {items.length === 0 ? (
        <EmptyState>
          Nenhum item de entrada ainda. Cadastre o primeiro abaixo — a Fase 2 amostra deste
          pool.
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {items.map((item) => (
            <li key={item.id}>
              <ItemCard projectId={projectId} item={item} />
            </li>
          ))}
        </ul>
      )}

      <Section title="Cadastrar item" divider={false}>
        <NewItemForm projectId={projectId} />
      </Section>
    </div>
  )
}
