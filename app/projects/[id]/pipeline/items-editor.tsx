'use client'

import {
  startTransition,
  useActionState,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react'
import {
  createItem,
  createItems,
  updateItem,
  deleteItem,
  type ItemState,
  type ItemsState,
} from './actions'
import type { InputItem } from './items'
import { itemPreviewLines } from './item-preview'
import { itemUsageMark } from '../round-usage'
import { RoundMarkBadge } from '../round-mark-badge'
import { Button, buttonClass } from '@/app/components/ui/button'
import { RowActions, RowMenuItem } from '@/app/components/ui/row-actions'
import { EditableRow } from '@/app/components/ui/editable-row'
import { Field, Input, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Panel } from '@/app/components/ui/panel'
import { SaveBar } from '@/app/components/ui/save-bar'
import { ConfirmDialog, DialogLines } from '@/app/components/ui/confirm-dialog'
import { Alert } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'
import { EmptyState } from '@/app/components/ui/empty-state'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { preWrapClass } from '@/app/components/ui/prose'
import { LockIcon, PlusIcon, SearchIcon } from '@/app/components/ui/icons'
import { cx } from '@/app/components/ui/cx'
import { plural } from '@/lib/plural'
import { ITEM_CONTENT_MAX, ITEM_NAME_MAX } from '@/lib/limits'
import {
  baseName,
  itemBatchLimitError,
  readItemBatch,
  readItemFile,
  removeFromBatch,
  ITEM_FILE_FORMATS,
  TEXT_FILE_ACCEPT,
  type ItemBatch,
  type ItemBatchReady,
} from './item-content'

const initialState: ItemState = null

const initialBatchState: ItemsState = null

const contentClass =
  'max-h-[50vh] min-h-[180px] overflow-auto font-mono text-[13px] leading-[1.6]'

const pickerClass =
  'relative has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-ring ' +
  'has-[:disabled]:pointer-events-none has-[:disabled]:opacity-60'

const editFileHint = `${ITEM_FILE_FORMATS} O conteúdo entra no campo abaixo e continua editável; o arquivo em si não é guardado.`

const DUPLICATE_LABEL: Record<NonNullable<ItemBatchReady['duplicate']>, string> = {
  pool: 'Já existe no pool',
  batch: 'Repetido no lote',
}

const FROZEN =
  'Já usado em uma rodada: editar ou remover mudaria o que os avaliadores viram, então este item não muda mais.'

function readingLabel(count: number): string | null {
  if (count === 0) return null
  return count > 1 ? `Lendo ${count} arquivos…` : 'Lendo o arquivo…'
}

function useItemFile(
  onLoad: (name: string, text: string) => void,
  batch?: { poolNames: string[]; onBatch: (batch: ItemBatch) => void },
) {
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(0)

  async function load(files: File[]) {
    if (files.length === 0) return
    setError(null)

    if (batch && files.length > 1) {
      setReading(files.length)
      const result = await readItemBatch(files, batch.poolNames)
      setReading(0)
      batch.onBatch(result)
      return
    }

    const file = files[0]
    setReading(1)
    const result = await readItemFile(file)
    setReading(0)

    if ('error' in result) {
      setError(result.error)
      return
    }
    onLoad(baseName(file.name), result.text)
  }

  return { error, reading: readingLabel(reading), load }
}

function useFileDrop(onFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false)

  return {
    over,
    dropProps: {
      onDragOver(event: DragEvent<HTMLElement>) {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setOver(true)
      },
      onDragLeave(event: DragEvent<HTMLElement>) {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
      },
      onDrop(event: DragEvent<HTMLElement>) {
        event.preventDefault()
        setOver(false)
        onFiles(Array.from(event.dataTransfer.files))
      },
    },
  }
}

function HiddenFileInput({
  disabled,
  multiple,
  onFiles,
}: {
  disabled: boolean
  multiple?: boolean
  onFiles: (files: File[]) => void
}) {
  return (
    <input
      type="file"
      accept={TEXT_FILE_ACCEPT}
      multiple={multiple}
      disabled={disabled}
      onChange={(event) => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        onFiles(files)
      }}
      className="sr-only"
    />
  )
}

function ItemFileField({ onText }: { onText: (text: string) => void }) {
  const { error, reading, load } = useItemFile((_name, text) => onText(text))

  return (
    <Field label="Carregar de um arquivo" hint={reading ?? editFileHint} error={error}>
      <span
        className={buttonClass('secondary', {
          size: 'sm',
          className: cx(pickerClass, 'self-start'),
        })}
      >
        <HiddenFileInput disabled={reading !== null} onFiles={(files) => void load(files)} />
        Escolher arquivo
      </span>
    </Field>
  )
}

function ItemDropZone({
  reading,
  onFiles,
}: {
  reading: string | null
  onFiles: (files: File[]) => void
}) {
  const { over, dropProps } = useFileDrop(onFiles)

  return (
    <div
      {...dropProps}
      className={cx(
        'flex flex-col items-center gap-3 rounded-card border border-dashed p-6 text-center',
        'transition-colors',
        over ? 'border-brand bg-accent-bg' : 'border-line-strong bg-surface-subtle',
      )}
    >
      <p className="m-0 text-sm font-semibold text-ink">
        {reading ?? 'Arraste arquivos de texto aqui'}
      </p>

      <label className={buttonClass('secondary', { className: pickerClass })}>
        <HiddenFileInput disabled={reading !== null} multiple onFiles={onFiles} />
        Escolher arquivo
      </label>

      <p className="m-0 text-xs text-muted">{ITEM_FILE_FORMATS}</p>
    </div>
  )
}

function ItemFields({
  name,
  content,
  onName,
  onContent,
  withFile = true,
}: {
  name: string
  content: string
  onName: (name: string) => void
  onContent: (content: string) => void
  withFile?: boolean
}) {
  return (
    <>
      <Field label="Nome do item" required>
        <Input
          type="text"
          name="name"
          required
          maxLength={ITEM_NAME_MAX}
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder="Ex.: Consulta 001"
        />
      </Field>

      {withFile ? <ItemFileField onText={onContent} /> : null}

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
          value={content}
          onChange={(event) => onContent(event.target.value)}
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
    <NewItemForm
      key={created ? created.nonce : 'idle'}
      projectId={projectId}
      name={created ? '' : draft.name}
      content={created ? '' : draft.content}
      action={action}
      pending={pending}
      error={state && 'error' in state ? state.error : null}
      created={created !== null}
      onClose={onClose}
    />
  )
}

function NewItemForm({
  projectId,
  action,
  pending,
  error,
  created,
  onClose,
  ...initial
}: {
  projectId: string
  name: string
  content: string
  action: (data: FormData) => void
  pending: boolean
  error: string | null
  created: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [content, setContent] = useState(initial.content)
  const dirty = name !== '' || content !== ''

  return (
    <Panel
      tone="accent"
      title="Novo item"
      action={
        <Button variant="secondary" size="sm" onClick={onClose}>
          {dirty ? 'Descartar' : 'Cancelar'}
        </Button>
      }
    >
      <Form action={action} gap="sm">
        <input type="hidden" name="project_id" value={projectId} />
        <ItemFields
          name={name}
          content={content}
          onName={setName}
          onContent={setContent}
          withFile={false}
        />

        {error !== null ? <Alert tone="error">{error}</Alert> : null}
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

export function ItemBatchPanel({
  projectId,
  batch: initial,
  onClose,
}: {
  projectId: string
  batch: ItemBatch
  onClose: () => void
}) {
  const [state, submit, pending] = useActionState(createItems, initialBatchState)
  const [batch, setBatch] = useState(initial)

  if (state && 'ok' in state) {
    return (
      <Alert tone="success">
        {`${plural(state.count, 'item cadastrado', 'itens cadastrados')}.`}
      </Alert>
    )
  }

  const { ready, refused } = batch
  const limitError = itemBatchLimitError(batch)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData()
    data.set('project_id', projectId)
    for (const entry of ready) {
      data.append('name', entry.name)
      data.append('content', entry.content)
    }
    startTransition(() => submit(data))
  }

  return (
    <Panel
      tone="accent"
      title={`Importar ${plural(ready.length + refused.length, 'arquivo', 'arquivos')}`}
      action={
        <Button variant="secondary" size="sm" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
      }
    >
      <Form onSubmit={onSubmit} gap="sm">
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[13px] font-semibold text-ink">
            {plural(ready.length, 'item pronto para cadastrar', 'itens prontos para cadastrar')}
            {refused.length > 0
              ? ` · ${plural(refused.length, 'arquivo recusado', 'arquivos recusados')}`
              : null}
          </p>
          <p className="m-0 text-xs text-muted">
            Cada arquivo vira um item com o nome do arquivo como título. Para renomear, use
            “Editar” no item depois de cadastrar.
          </p>
        </div>

        {ready.length > 0 ? (
          <ul
            className={cx(
              'm-0 flex list-none flex-col divide-y divide-line p-0',
              'rounded-control border border-line bg-surface',
              'max-h-[50vh] overflow-y-auto',
            )}
          >
            {ready.map((entry) => (
              <li key={entry.key} className="flex items-center gap-3 px-3 py-2">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 text-sm font-semibold break-words text-ink">
                    {entry.name}
                  </span>
                  {entry.duplicate ? (
                    <Badge tone="warning">{DUPLICATE_LABEL[entry.duplicate]}</Badge>
                  ) : null}
                </span>
                <Button
                  variant="quiet"
                  className="shrink-0"
                  disabled={pending}
                  aria-label={`Tirar “${entry.name}” do lote`}
                  onClick={() => setBatch(removeFromBatch(batch, entry.key))}
                >
                  Tirar
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {refused.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-[13px] font-semibold text-label">
              Recusados (ficam de fora do cadastro)
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-muted">
              {refused.map((entry) => (
                <li key={entry.key} className="flex flex-wrap gap-x-2">
                  <span className="min-w-0 break-words">{entry.name}</span>
                  <span>{`· ${entry.reason}`}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {limitError !== null ? <Alert tone="error">{limitError}</Alert> : null}
        {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

        <FormActions align="start">
          <Button
            type="submit"
            disabled={ready.length === 0 || limitError !== null}
            loading={pending}
            loadingText="Cadastrando…"
          >
            {`Cadastrar ${plural(ready.length, 'item', 'itens')}`}
          </Button>
        </FormActions>
      </Form>
    </Panel>
  )
}

function itemChanges(nameChanged: boolean, contentChanged: boolean): string {
  if (nameChanged && contentChanged) return 'Nome e conteúdo alterados.'
  return nameChanged ? 'Nome alterado.' : 'Conteúdo alterado.'
}

function EditItemForm({
  projectId,
  item,
  action,
  pending,
  error,
  onClose,
}: {
  projectId: string
  item: InputItem
  action: (data: FormData) => void
  pending: boolean
  error: string | null
  onClose: () => void
}) {
  const [name, setName] = useState(item.name)
  const [content, setContent] = useState(item.content)
  const nameChanged = name !== item.name
  const contentChanged = content !== item.content
  const dirty = nameChanged || contentChanged

  function discard() {
    setName(item.name)
    setContent(item.content)
    onClose()
  }

  return (
    <Form action={action} gap="sm">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="item_id" value={item.id} />
      <ItemFields name={name} content={content} onName={setName} onContent={setContent} />

      {error !== null ? <Alert tone="error">{error}</Alert> : null}

      <SaveBar
        dirty={dirty}
        changes={itemChanges(nameChanged, contentChanged)}
        onDiscard={discard}
        loading={pending}
        loadingText="Salvando…"
      />
    </Form>
  )
}

function ItemRowActions({ projectId, item }: { projectId: string; item: InputItem }) {
  const [state, action, pending] = useActionState(deleteItem, initialState)

  return (
    <>
      <ConfirmDialog
        trigger={(open) => (
          <RowActions menuLabel={`Mais ações do item ${item.name}`}>
            <RowMenuItem onClick={open} disabled={pending} aria-busy={pending || undefined}>
              {pending ? 'Removendo…' : 'Remover'}
            </RowMenuItem>
          </RowActions>
        )}
        title={`Remover o item “${item.name}”?`}
        confirmLabel="Remover item"
        pendingLabel="Removendo…"
        tone="danger"
        action={action}
        fields={{ project_id: projectId, item_id: item.id }}
      >
        <DialogLines lines={['O conteúdo dele é apagado.']} />
      </ConfirmDialog>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
    </>
  )
}

function ItemRow({
  projectId,
  item,
  selected,
  onOpen,
  onClose,
}: {
  projectId: string
  item: InputItem
  selected: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const [state, action, pending] = useActionState(updateItem, initialState)
  const savedNonce = state && 'ok' in state ? state.nonce : null
  const [openedNonce, setOpenedNonce] = useState<number | null>(null)
  const expanded = selected && (savedNonce === null || savedNonce === openedNonce)
  const saved = selected && !expanded

  function open() {
    setOpenedNonce(savedNonce)
    onOpen()
  }

  const lines = item.content.split('\n').length
  const usage = itemUsageMark(item.rounds)

  return (
    <EditableRow
      expanded={expanded}
      onToggle={expanded ? onClose : open}
      title={item.name}
      meta={`${plural(item.content.length, 'caractere', 'caracteres')} · ${plural(lines, 'linha', 'linhas')}`}
      preview={
        <div className="flex flex-col gap-2">
          {saved ? <Alert tone="success">Item atualizado.</Alert> : null}
          <p className={`m-0 text-[13px] ${preWrapClass} text-muted`}>
            {itemPreviewLines(item.content)}
          </p>
        </div>
      }
      badges={
        <>
          {usage ? <RoundMarkBadge mark={usage} /> : null}
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
      collapseLabel={item.isEditable ? undefined : 'Fechar'}
      footer={item.isEditable ? null : FROZEN}
    >
      {item.isEditable ? (
        <EditItemForm
          projectId={projectId}
          item={item}
          action={action}
          pending={pending}
          error={state && 'error' in state ? state.error : null}
          onClose={onClose}
        />
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
  const [batch, setBatch] = useState<{ key: number; batch: ItemBatch } | null>(null)
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function openDraft(name: string, content: string) {
    setBatch(null)
    setDraft({ key: Date.now(), name, content })
  }

  function openBatch(next: ItemBatch) {
    setDraft(null)
    setBatch({ key: Date.now(), batch: next })
  }

  const { error, reading, load } = useItemFile(openDraft, {
    poolNames: items.map((item) => item.name),
    onBatch: openBatch,
  })
  const loadFiles = (files: File[]) => void load(files)
  const { over, dropProps } = useFileDrop(loadFiles)

  const search = query.trim().toLowerCase()
  const visible = search
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.content.toLowerCase().includes(search),
      )
    : items

  const characters = items.reduce((total, item) => total + item.content.length, 0)
  const empty = items.length === 0
  const fileError = error ? <Alert tone="error">{error}</Alert> : null

  return (
    <div className="flex flex-col gap-5">
      {empty ? (
        <Panel title="Enviar itens">
          <div className="flex flex-col gap-3">
            <ItemDropZone reading={reading} onFiles={loadFiles} />
            {fileError}
          </div>
        </Panel>
      ) : null}

      <div className="flex flex-col gap-3">
        {empty && draft ? null : (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            {empty ? null : (
              <p className="m-0 text-[13px] font-semibold text-ink">
                {plural(items.length, 'item', 'itens')} no pool ·{' '}
                {plural(characters, 'caractere', 'caracteres')} no total
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {empty ? null : (
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
              )}

              {empty ? null : (
                <label className={buttonClass('secondary', { className: pickerClass })}>
                  <HiddenFileInput disabled={reading !== null} multiple onFiles={loadFiles} />
                  {reading ?? 'Importar arquivo'}
                </label>
              )}

              {draft ? null : (
                <Button onClick={() => openDraft('', '')}>
                  <PlusIcon />
                  Novo item
                </Button>
              )}
            </div>
          </div>
        )}

        {empty ? null : fileError}

        {batch ? (
          <ItemBatchPanel
            key={batch.key}
            projectId={projectId}
            batch={batch.batch}
            onClose={() => setBatch(null)}
          />
        ) : null}

        {draft ? (
          <NewItemPanel
            key={draft.key}
            projectId={projectId}
            draft={draft}
            onClose={() => setDraft(null)}
          />
        ) : null}

        {empty ? (
          <EmptyState>
            Nenhum item de entrada ainda. Envie o primeiro pelo bloco acima.
          </EmptyState>
        ) : (
          <div
            {...dropProps}
            className={cx(
              'rounded-card transition-colors',
              over && 'bg-accent-bg outline-2 outline-offset-4 outline-brand outline-dashed',
            )}
          >
            {visible.length === 0 ? (
              <EmptyState>Nenhum item do pool corresponde a “{query.trim()}”.</EmptyState>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {visible.map((item) => (
                  <li key={item.id}>
                    <ItemRow
                      projectId={projectId}
                      item={item}
                      selected={expandedId === item.id}
                      onOpen={() => setExpandedId(item.id)}
                      onClose={() => setExpandedId(null)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

