'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import { saveCodebook, type CodebookState } from './actions'
import type {
  CodebookCriterion,
  CodebookDefinition,
  CodebookVersion,
} from './codebook'
import {
  DEFINITION_TYPE_OPTIONS,
  type DefinitionType,
} from '@/app/projects/definition-types'
import { Button } from '@/app/components/ui/button'
import { RowActions, RowMenuItem } from '@/app/components/ui/row-actions'
import { Disclosure } from '@/app/components/ui/disclosure'
import { Field, Input, Select, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { SaveBar } from '@/app/components/ui/save-bar'
import { Card } from '@/app/components/ui/card'
import { Alert } from '@/app/components/ui/alert'
import { VersionStatus } from './version-status'
import { DefinitionList } from './definition-list'
import { EmptyState } from '@/app/components/ui/empty-state'
import { moveBy } from '@/lib/reorder'
import { PHASE_2 } from './preconditions'
import { definitionsWithoutCriteria, missingCriteriaMessage } from './criteria'
import { codebookLockedMessage } from '../(tabs)/rounds/preconditions'
import { CodebookSummary } from './criteria-summary'
import {
  CODEBOOK_NOTE_MAX,
  CRITERION_DESCRIPTION_MAX,
  CRITERION_NAME_MAX,
  DEFINITION_DESCRIPTION_MAX,
  DEFINITION_TITLE_MAX,
} from '@/lib/limits'

const initialState: CodebookState = null

type CriterionRow = {
  key: number
  name: string
  description: string
}

type Row = {
  key: number
  title: string
  type: DefinitionType | ''
  description: string
  criteria: CriterionRow[]
}

let nextKey = 0

function newCriterion(): CriterionRow {
  return { key: nextKey++, name: '', description: '' }
}

function toCriterionRows(criteria: CodebookCriterion[]): CriterionRow[] {
  return criteria.map((criterion) => ({
    key: nextKey++,
    name: criterion.name,
    description: criterion.description ?? '',
  }))
}

function newRow(type: DefinitionType | null): Row {
  return { key: nextKey++, title: '', type: type ?? '', description: '', criteria: [] }
}

function toRows(
  definitions: CodebookDefinition[],
  criteria: CodebookCriterion[],
  fallback: DefinitionType | null,
): Row[] {
  if (definitions.length === 0) return [newRow(fallback)]
  return definitions.map((definition) => ({
    key: nextKey++,
    title: definition.title,
    type: (definition.type as DefinitionType) ?? '',
    description: definition.description ?? '',
    criteria: toCriterionRows(
      criteria.filter((criterion) => criterion.definitionId === definition.id),
    ),
  }))
}

function serializeCriteria(criteria: readonly CriterionRow[]): string {
  return JSON.stringify(
    criteria.map((criterion) => [criterion.name.trim(), criterion.description.trim()]),
  )
}

function serializeRow(row: Row): string {
  return JSON.stringify([
    row.title.trim(),
    row.type,
    row.description.trim(),
    serializeCriteria(row.criteria),
  ])
}

function countChanged(before: readonly string[], after: readonly string[]): number {
  const shared = Math.min(before.length, after.length)
  let changed = Math.abs(before.length - after.length)
  for (let index = 0; index < shared; index++) {
    if (before[index] !== after[index]) changed++
  }
  return changed
}

function changesLabel(
  changedDefinitions: number,
  generalChanged: boolean,
  noteChanged: boolean,
): string {
  const parts: string[] = []
  if (changedDefinitions > 0) {
    parts.push(
      changedDefinitions === 1
        ? '1 definição alterada'
        : `${changedDefinitions} definições alteradas`,
    )
  }
  if (generalChanged) parts.push('critérios gerais alterados')
  if (noteChanged) parts.push('observação alterada')
  return `Alterações não salvas: ${parts.join(' · ')}.`
}

function TypeLegend() {
  return (
    <Disclosure summary="O que é cada tipo">
      <Card tone="subtle" padding="sm" className="mt-2">
        <dl className="m-0 flex flex-col gap-1.5">
          {DEFINITION_TYPE_OPTIONS.map((option) => (
            <div key={option.value} className="flex flex-wrap gap-x-2 text-[13px]">
              <dt className="font-semibold text-ink">{option.label}</dt>
              <dd className="m-0 min-w-[200px] flex-1 text-muted">{option.hint}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </Disclosure>
  )
}

function generalScopeLabel(definitionCount: number): string {
  const scope =
    definitionCount === 0
      ? 'Valem para todas as definições desta versão.'
      : definitionCount === 1
        ? 'Valem para a definição desta versão.'
        : `Valem para as ${definitionCount} definições desta versão.`
  return `${scope} Editar ou remover um critério geral vale para todas elas.`
}

function CodebookBody({
  definitions,
  criteria,
  inPhase2,
}: {
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  inPhase2: boolean
}) {
  return (
    <>
      {inPhase2 && definitions.length > 0 ? (
        <CodebookSummary definitions={definitions} criteria={criteria} />
      ) : null}
      <TypeLegend />
      {definitions.length === 0 ? (
        <EmptyState>Esta versão não tem definições.</EmptyState>
      ) : (
        <DefinitionList definitions={definitions} criteria={criteria} />
      )}
    </>
  )
}

function CriterionFields({
  scope,
  criteria,
  label,
  addLabel,
  emptyHint,
  onChange,
}: {
  scope: string
  criteria: CriterionRow[]
  label: string
  addLabel: string
  emptyHint: string
  onChange: (next: CriterionRow[]) => void
}) {
  function update(key: number, patch: Partial<CriterionRow>) {
    onChange(
      criteria.map((criterion) =>
        criterion.key === key ? { ...criterion, ...patch } : criterion,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {criteria.length === 0 ? (
        <p className="m-0 text-[13px] text-muted">{emptyHint}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {criteria.map((criterion, index) => (
            <li key={criterion.key}>
              <Card tone="subtle" padding="sm">
                <input type="hidden" name="criterion_scope" value={scope} />

                <div className="flex flex-wrap items-end gap-3">
                  <Field
                    label={`${label} ${index + 1}`}
                    required
                    className="min-w-[220px] flex-1"
                  >
                    <Input
                      type="text"
                      name="criterion_name"
                      required
                      maxLength={CRITERION_NAME_MAX}
                      value={criterion.name}
                      onChange={(e) => update(criterion.key, { name: e.target.value })}
                      placeholder="Ex.: a resposta cita a fonte"
                    />
                  </Field>

                  <RowActions
                    className="mb-1.5"
                    menuLabel={`Mais ações do ${label.toLocaleLowerCase('pt-BR')} ${index + 1}`}
                    up={{
                      label: `Mover o ${label.toLocaleLowerCase('pt-BR')} ${index + 1} para cima`,
                      disabled: index === 0,
                      onClick: () => onChange(moveBy(criteria, index, -1)),
                    }}
                    down={{
                      label: `Mover o ${label.toLocaleLowerCase('pt-BR')} ${index + 1} para baixo`,
                      disabled: index === criteria.length - 1,
                      onClick: () => onChange(moveBy(criteria, index, 1)),
                    }}
                  >
                    <RowMenuItem
                      onClick={() =>
                        onChange(criteria.filter((c) => c.key !== criterion.key))
                      }
                    >
                      Remover
                    </RowMenuItem>
                  </RowActions>
                </div>

                <div className="mt-2.5">
                  <Field label="Descrição do critério (opcional)">
                    <Textarea
                      name="criterion_description"
                      rows={2}
                      maxLength={CRITERION_DESCRIPTION_MAX}
                      value={criterion.description}
                      onChange={(e) =>
                        update(criterion.key, { description: e.target.value })
                      }
                      placeholder="Ex.: vale Alto quando a fonte é citada e verificável."
                    />
                  </Field>
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
          onClick={() => onChange([...criteria, newCriterion()])}
        >
          {addLabel}
        </Button>
      </FormActions>
    </div>
  )
}

function CodebookFields({
  definitions,
  criteria,
  defaultType,
  note,
  inPhase2,
  pending,
  status,
  onDone,
}: {
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  defaultType: DefinitionType | null
  note: string
  inPhase2: boolean
  pending: boolean
  status: React.ReactNode
  onDone: () => void
}) {
  const [initial] = useState(() => ({
    rows: toRows(definitions, criteria, defaultType),
    general: toCriterionRows(
      criteria.filter((criterion) => criterion.definitionId === null),
    ),
    note,
  }))
  const [rows, setRows] = useState<Row[]>(initial.rows)
  const [general, setGeneral] = useState<CriterionRow[]>(initial.general)
  const [noteText, setNoteText] = useState(initial.note)

  function update(key: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  function move(index: number, offset: number) {
    setRows((current) => moveBy(current, index, offset))
  }

  const uncovered = definitionsWithoutCriteria(
    rows.map((row) => ({ id: String(row.key), title: row.title })),
    [
      ...rows.flatMap((row) => row.criteria.map(() => ({ definitionId: String(row.key) }))),
      ...general.map(() => ({ definitionId: null })),
    ],
  )

  const changedDefinitions = countChanged(
    initial.rows.map(serializeRow),
    rows.map(serializeRow),
  )
  const generalChanged =
    serializeCriteria(initial.general) !== serializeCriteria(general)
  const noteChanged = initial.note.trim() !== noteText.trim()
  const dirty = changedDefinitions > 0 || generalChanged || noteChanged

  useEffect(() => {
    if (!dirty) return
    function warnOnLeave(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnOnLeave)
    return () => window.removeEventListener('beforeunload', warnOnLeave)
  }, [dirty])

  function discard() {
    setRows(initial.rows)
    setGeneral(initial.general)
    setNoteText(initial.note)
    onDone()
  }

  const summaryDefinitions = rows.map((row) => ({ id: String(row.key) }))
  const summaryCriteria = [
    ...rows.flatMap((row) =>
      row.criteria.map(() => ({ definitionId: String(row.key) })),
    ),
    ...general.map(() => ({ definitionId: null })),
  ]

  return (
    <>
      {inPhase2 ? (
        <CodebookSummary
          definitions={summaryDefinitions}
          criteria={summaryCriteria}
        />
      ) : null}

      {inPhase2 ? (
        <Card padding="sm">
          <h3 className="m-0 text-sm font-bold text-ink">Critérios gerais</h3>
          <p className="m-0 mt-1 mb-3 text-[13px] text-muted">
            {generalScopeLabel(rows.length)}
          </p>
          <CriterionFields
            scope="general"
            criteria={general}
            label="Nome do critério geral"
            addLabel="Adicionar critério geral"
            emptyHint="Nenhum critério geral nesta versão."
            onChange={setGeneral}
          />
        </Card>
      ) : null}

      <p className="m-0 text-[13px] text-muted">
        A ordem desta lista é a ordem em que as definições aparecem para a equipe e são
        enviadas à LLM. Use as setas para reordenar; a ordem é salva junto com a versão.
      </p>

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

                  <RowActions
                    className="mb-1.5"
                    menuLabel={`Mais ações da definição ${index + 1}`}
                    up={{
                      label: `Mover a definição ${index + 1} para cima`,
                      disabled: index === 0,
                      onClick: () => move(index, -1),
                    }}
                    down={{
                      label: `Mover a definição ${index + 1} para baixo`,
                      disabled: index === rows.length - 1,
                      onClick: () => move(index, 1),
                    }}
                  >
                    <RowMenuItem
                      onClick={() =>
                        setRows((current) => current.filter((r) => r.key !== row.key))
                      }
                    >
                      Remover
                    </RowMenuItem>
                  </RowActions>
                </div>

                {inPhase2 ? (
                  <>
                    <div className="mt-3">
                      <Field
                        label={`Descrição da definição ${index + 1} (opcional)`}
                        hint="O texto que o avaliador lê para entender o que o título quis dizer. Salvar sem descrição é permitido."
                      >
                        <Textarea
                          name="definition_description"
                          rows={3}
                          maxLength={DEFINITION_DESCRIPTION_MAX}
                          value={row.description}
                          onChange={(e) =>
                            update(row.key, { description: e.target.value })
                          }
                          placeholder="Ex.: a resposta busca informação sobre um assunto, sem intenção de compra."
                        />
                      </Field>
                    </div>

                    <div className="mt-3 border-t border-line pt-3">
                      <CriterionFields
                        scope={String(index)}
                        criteria={row.criteria}
                        label="Nome do critério"
                        addLabel="Adicionar critério"
                        emptyHint="Nenhum critério próprio nesta definição. Ela também recebe os critérios gerais da versão."
                        onChange={(next) => update(row.key, { criteria: next })}
                      />
                    </div>
                  </>
                ) : null}
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

      {inPhase2 && uncovered.length > 0 ? (
        <Alert tone="notice">
          {missingCriteriaMessage(
            uncovered.map((row, index) => row.title || `sem título ${index + 1}`),
          )}
        </Alert>
      ) : null}

      <Field
        label="Observação desta versão (opcional)"
        hint="Fica presa a esta versão e aparece no histórico. Salvar sem observação é permitido."
      >
        <Textarea
          name="note"
          rows={2}
          maxLength={CODEBOOK_NOTE_MAX}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Ex.: separei “Transacional” de “Navegacional”."
        />
      </Field>

      {status}

      {dirty ? (
        <SaveBar
          changes={changesLabel(changedDefinitions, generalChanged, noteChanged)}
          onDiscard={discard}
          loading={pending}
          loadingText="Salvando…"
          saveLabel="Salvar definições"
        />
      ) : (
        <FormActions align="start">
          <Button variant="secondary" onClick={onDone}>
            Voltar à leitura
          </Button>
        </FormActions>
      )}
    </>
  )
}

export function CodebookReadOnly({
  version,
  isOpen,
  openRoundNumber,
  definitions,
  criteria,
  inPhase2,
}: {
  version: CodebookVersion | null
  isOpen: boolean
  openRoundNumber: number | null
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  inPhase2: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <VersionStatus version={version} isOpen={isOpen} />
      {openRoundNumber !== null ? (
        <Alert tone="notice">{codebookLockedMessage(openRoundNumber)}</Alert>
      ) : null}
      <CodebookBody definitions={definitions} criteria={criteria} inPhase2={inPhase2} />
    </div>
  )
}

export function CodebookEditor({
  projectId,
  phase,
  version,
  isOpen,
  openRoundNumber = null,
  definitions,
  criteria,
  defaultType,
}: {
  projectId: string
  phase: number
  version: CodebookVersion | null
  isOpen: boolean
  openRoundNumber?: number | null
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  defaultType: DefinitionType | null
}) {
  const inPhase2 = phase >= PHASE_2
  const [state, submit, pending] = useActionState(saveCodebook, initialState)

  const saved = state !== null && 'ok' in state
  const savedNonce = saved ? state.nonce : 0
  const [editingNonce, setEditingNonce] = useState<number | null>(null)
  const editing = editingNonce === savedNonce

  if (openRoundNumber !== null) {
    return (
      <CodebookReadOnly
        version={version}
        isOpen={isOpen}
        openRoundNumber={openRoundNumber}
        definitions={definitions}
        criteria={criteria}
        inPhase2={inPhase2}
      />
    )
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-4">
        <VersionStatus version={version} isOpen={isOpen} />
        <CodebookBody
          definitions={definitions}
          criteria={criteria}
          inPhase2={inPhase2}
        />
        {saved ? <Alert tone="success">Definições salvas.</Alert> : null}
        <FormActions align="start">
          <Button onClick={() => setEditingNonce(savedNonce)}>Editar definições</Button>
        </FormActions>
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
          criteria={criteria}
          defaultType={defaultType}
          note={version?.note ?? ''}
          inPhase2={inPhase2}
          pending={pending}
          status={
            state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null
          }
          onDone={() => setEditingNonce(null)}
        />
      </Form>
    </div>
  )
}
