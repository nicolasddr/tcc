'use client'

import { startTransition, useActionState, useState } from 'react'
import { saveCodebook, type CodebookState } from './actions'
import type { CodebookDefinition, CodebookVersion } from './codebook'
import {
  DEFINITION_TYPE_OPTIONS,
  definitionTypeLabel,
  type DefinitionType,
} from '@/app/projects/definition-types'
import { Button } from '@/app/components/ui/button'
import { Field, Input, Select, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Alert } from '@/app/components/ui/alert'
import { VersionStatus } from './version-status'
import { EmptyState } from '@/app/components/ui/empty-state'
import { CODEBOOK_NOTE_MAX, DEFINITION_TITLE_MAX } from '@/lib/limits'

const initialState: CodebookState = null

type Row = { key: number; title: string; type: DefinitionType | '' }

let nextKey = 0

function newRow(type: DefinitionType | null): Row {
  return { key: nextKey++, title: '', type: type ?? '' }
}

function toRows(definitions: CodebookDefinition[], fallback: DefinitionType | null): Row[] {
  if (definitions.length === 0) return [newRow(fallback)]
  return definitions.map((definition) => ({
    key: nextKey++,
    title: definition.title,
    type: (definition.type as DefinitionType) ?? '',
  }))
}

function TypeLegend() {
  return (
    <Card tone="subtle" padding="sm">
      <dl className="m-0 flex flex-col gap-1.5">
        {DEFINITION_TYPE_OPTIONS.map((option) => (
          <div key={option.value} className="flex flex-wrap gap-x-2 text-[13px]">
            <dt className="font-semibold text-ink">{option.label}</dt>
            <dd className="m-0 min-w-[200px] flex-1 text-muted">{option.hint}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function FrozenCodebook({ definitions }: { definitions: CodebookDefinition[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {definitions.map((definition) => (
        <li key={definition.id}>
          <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{definition.title}</span>
            <Badge tone="accent">
              {definitionTypeLabel(definition.type) ?? definition.type}
            </Badge>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function CodebookFields({
  definitions,
  defaultType,
  note,
}: {
  definitions: CodebookDefinition[]
  defaultType: DefinitionType | null
  note: string
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(definitions, defaultType))

  function update(key: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState>
          Nenhuma definição na lista. Adicione ao menos uma para poder salvar.
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row, index) => (
            <li key={row.key}>
              <Card padding="sm">
                <div className="flex flex-wrap items-end gap-3">
                  <Field
                    label={`Título da definição ${index + 1}`}
                    required
                    className="min-w-[220px] flex-[2]"
                  >
                    <Input
                      type="text"
                      name="definition_title"
                      required
                      maxLength={DEFINITION_TITLE_MAX}
                      value={row.title}
                      onChange={(e) => update(row.key, { title: e.target.value })}
                      placeholder="Ex.: Informacional"
                    />
                  </Field>

                  <Field label="Tipo" required className="min-w-[200px] flex-1">
                    <Select
                      name="definition_type"
                      required
                      value={row.type}
                      onChange={(e) =>
                        update(row.key, { type: e.target.value as DefinitionType })
                      }
                    >
                      <option value="">Escolha um tipo…</option>
                      {DEFINITION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      setRows((current) => current.filter((r) => r.key !== row.key))
                    }
                  >
                    Remover
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <FormActions align="start">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRows((current) => [...current, newRow(defaultType)])}
        >
          Adicionar definição
        </Button>
      </FormActions>

      <Field
        label="Observação desta versão (opcional)"
        hint="Fica presa a esta versão e aparece no histórico. Salvar sem observação é permitido."
      >
        <Textarea
          name="note"
          rows={2}
          maxLength={CODEBOOK_NOTE_MAX}
          defaultValue={note}
          placeholder="Ex.: separei “Transacional” de “Navegacional”."
        />
      </Field>
    </>
  )
}

export function CodebookEditor({
  projectId,
  version,
  isOpen,
  definitions,
  defaultType,
}: {
  projectId: string
  version: CodebookVersion | null
  isOpen: boolean
  definitions: CodebookDefinition[]
  defaultType: DefinitionType | null
}) {
  const [state, submit, pending] = useActionState(saveCodebook, initialState)

  if (!isOpen) {
    return (
      <div className="flex flex-col gap-4">
        <VersionStatus version={version} isOpen={isOpen} />
        <TypeLegend />
        {definitions.length === 0 ? (
          <EmptyState>Esta versão não tem definições.</EmptyState>
        ) : (
          <FrozenCodebook definitions={definitions} />
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
      <TypeLegend />

      <Form onSubmit={onSubmit} gap="sm">
        <input type="hidden" name="project_id" value={projectId} />
        {version ? <input type="hidden" name="version_id" value={version.id} /> : null}

        <CodebookFields
          definitions={definitions}
          defaultType={defaultType}
          note={version?.note ?? ''}
        />

        {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
        {state && 'ok' in state ? <Alert tone="success">Definições salvas.</Alert> : null}

        <FormActions>
          <Button type="submit" loading={pending} loadingText="Salvando…">
            Salvar definições
          </Button>
        </FormActions>
      </Form>
    </div>
  )
}
