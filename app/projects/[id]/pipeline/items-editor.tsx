'use client'

import { useActionState, useState } from 'react'
import { createItem, updateItem, deleteItem, type ItemState } from './actions'
import type { InputItem } from './items'
import { itemPreviewLines } from './item-preview'
import { itemUsageLabel } from './item-usage'
import { Button } from '@/app/components/ui/button'
import { RowActions, RowMenuItem } from '@/app/components/ui/row-actions'
import { EditableRow } from '@/app/components/ui/editable-row'
import { Field, Input, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Panel } from '@/app/components/ui/panel'
import { Badge } from '@/app/components/ui/badge'
import { Alert } from '@/app/components/ui/alert'
import { EmptyState } from '@/app/components/ui/empty-state'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { preWrapClass } from '@/app/components/ui/prose'
import { LockIcon, PlusIcon, SearchIcon } from '@/app/components/ui/icons'
import { cx } from '@/app/components/ui/cx'
import { plural } from '@/lib/plural'
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

const FORMATS = `Formatos de texto (${TEXT_FILE_EXAMPLES}) e arquivos de código, até ${ITEM_FILE_LIMIT_LABEL}.`

const fileHint = `${FORMATS} O conteúdo entra no formulário e continua editável antes de cadastrar; o arquivo em si não é guardado.`

const editFileHint = `${FORMATS} O conteúdo entra no campo abaixo e continua editável; o arquivo em si não é guardado.`

const ONE_FILE =
  'Nesta fase, um arquivo por vez: arraste um arquivo só, ou repita o envio para cada item.'

const FROZEN =
  'Já usado em uma rodada: editar ou remover mudaria o que os avaliadores viram, então este item não muda mais.'

function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

function useItemFile(onLoad: (name: string, text: string) => void) {
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  async function load(files: File[]) {
    if (files.length === 0) return
    if (files.length > 1) {
      setError(ONE_FILE)
      return
    }

    const file = files[0]
    setError(null)
    setReading(true)
    const result = await readItemFile(file)
    setReading(false)

    if ('error' in result) {
      setError(result.error)
      return
    }
    onLoad(baseName(file.name), result.text)
  }

  return { error, reading, load }
}

function ItemFileField({ onText }: { onText: (text: string) => void }) {
  const { error, reading, load } = useItemFile((_name, text) => onText(text))

  return (
    <Field
      label="Carregar de um arquivo"
      hint={reading ? 'Lendo o arquivo…' : editFileHint}
      error={error}
    >
      <input
        type="file"
        accept={TEXT_FILE_ACCEPT}
        disabled={reading}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void load(files)
        }}
        className={fileInputClass}
      />
    </Field>
  )
}

function ItemDropZone({ onLoad }: { onLoad: (name: string, text: string) => void }) {
  const { error, reading, load } = useItemFile(onLoad)
  const [over, setOver] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          void load(Array.from(event.dataTransfer.files))
        }}
        className={cx(
          'flex flex-col items-center gap-3 rounded-card border border-dashed p-6 text-center',
          'transition-colors',
          over ? 'border-brand bg-accent-bg' : 'border-line-strong bg-surface-subtle',
        )}
      >
        <p className="m-0 text-sm font-semibold text-ink">
          {reading ? 'Lendo o arquivo…' : 'Arraste um arquivo de texto aqui'}
        </p>

        <input
          type="file"
          accept={TEXT_FILE_ACCEPT}
          disabled={reading}
          aria-label="Escolher um arquivo de texto"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            void load(files)
          }}
          className={cx(fileInputClass, 'max-w-[440px]')}
        />

        <p className="m-0 text-xs text-muted">{FORMATS}</p>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  )
}

function ItemFields({
  name,
  content,
  withFile = true,
}: {
  name?: string
  content?: string
  withFile?: boolean
}) {
  const [text, setText] = useState(content ?? '')

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

      {withFile ? <ItemFileField onText={setText} /> : null}

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

type Draft = { key: number; name: string; content: string }

function NewItemPanel({
  projectId,
  draft,
  onClose,
}: {
  projectId: string
  draft: Draft
  onClose: () => void
}) {
  const [state, action, pending] = useActionState(createItem, initialState)
  const created = state && 'ok' in state ? state : null

  return (
    <Panel
      tone="accent"
      title="Novo item"
      action={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <Form action={action} gap="sm">
        <input type="hidden" name="project_id" value={projectId} />
        <ItemFields
          key={created ? created.nonce : 'idle'}
          name={created ? undefined : draft.name}
          content={created ? undefined : draft.content}
          withFile={false}
        />

        {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
        {created ? <Alert tone="success">Item cadastrado.</Alert> : null}

        <FormActions align="start">
          <Button type="submit" loading={pending} loadingText="Cadastrando…">
            Cadastrar item
          </Button>
        </FormActions>
      </Form>
    </Panel>
  )
}

function EditItemForm({ projectId, item }: { projectId: string; item: InputItem }) {
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

function ItemRow({
  projectId,
  item,
  expanded,
  onToggle,
}: {
  projectId: string
  item: InputItem
  expanded: boolean
  onToggle: () => void
}) {
  const lines = item.content.split('\n').length
  const usage = itemUsageLabel(item.roundNumbers)

  return (
    <EditableRow
      expanded={expanded}
      onToggle={onToggle}
      title={item.name}
      meta={`${plural(item.content.length, 'caractere', 'caracteres')} · ${plural(lines, 'linha', 'linhas')}`}
      preview={
        <p className={`m-0 text-[13px] ${preWrapClass} text-muted`}>
          {itemPreviewLines(item.content)}
        </p>
      }
      badges={
        <>
          {usage ? <Badge tone="neutral">{usage}</Badge> : null}
          {item.isEditable ? null : (
            <span className="inline-flex items-center gap-1 text-muted">
              <LockIcon />
              <InfoTooltip text={FROZEN} />
            </span>
          )}
        </>
      }
      actions={
        item.isEditable ? <ItemRowActions projectId={projectId} item={item} /> : null
      }
      expandLabel={item.isEditable ? 'Editar' : 'Ver conteúdo'}
      collapseLabel={item.isEditable ? 'Concluir edição' : 'Fechar'}
      footer={item.isEditable ? null : FROZEN}
    >
      {item.isEditable ? (
        <EditItemForm projectId={projectId} item={item} />
      ) : (
        <p className={`m-0 ${contentClass} ${preWrapClass} text-ink`}>{item.content}</p>
      )}
    </EditableRow>
  )
}

export function ItemsEditor({
  projectId,
  items,
}: {
  projectId: string
  items: InputItem[]
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function openDraft(name: string, content: string) {
    setDraft({ key: Date.now(), name, content })
  }

  const search = query.trim().toLowerCase()
  const visible = search
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.content.toLowerCase().includes(search),
      )
    : items

  const characters = items.reduce((total, item) => total + item.content.length, 0)

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title={
          <>
            Upload de itens
            <InfoTooltip text={fileHint} />
          </>
        }
      >
        <ItemDropZone onLoad={openDraft} />
      </Panel>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="m-0 text-[13px] font-semibold text-ink">
            {plural(items.length, 'item', 'itens')} no pool ·{' '}
            {plural(characters, 'caractere', 'caracteres')} no total
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="relative inline-flex items-center">
              <SearchIcon className="pointer-events-none absolute left-3 text-muted" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Buscar itens pelo nome ou pelo conteúdo"
                placeholder="Buscar no pool"
                className="w-[240px] pl-9"
              />
            </span>

            {draft ? null : (
              <Button onClick={() => openDraft('', '')}>
                <PlusIcon />
                Novo item
              </Button>
            )}
          </div>
        </div>

        {draft ? (
          <NewItemPanel
            key={draft.key}
            projectId={projectId}
            draft={draft}
            onClose={() => setDraft(null)}
          />
        ) : null}

        {items.length === 0 ? (
          <EmptyState>
            Nenhum item de entrada ainda. Traga o primeiro pelo bloco acima — a Fase 2
            amostra deste pool.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState>Nenhum item do pool corresponde a “{query.trim()}”.</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {visible.map((item) => (
              <li key={item.id}>
                <ItemRow
                  projectId={projectId}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() =>
                    setExpandedId((current) => (current === item.id ? null : item.id))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
