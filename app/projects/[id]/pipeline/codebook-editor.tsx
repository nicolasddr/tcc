'use client'

import { startTransition, useActionState, useState } from 'react'
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
import { Field, Input, Select, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Card } from '@/app/components/ui/card'
import { Alert } from '@/app/components/ui/alert'
import { VersionStatus } from './version-status'
import { DefinitionList } from './definition-list'
import { EmptyState } from '@/app/components/ui/empty-state'
import { moveBy } from '@/lib/reorder'
import { PHASE_2 } from './preconditions'
import { definitionsWithoutCriteria, missingCriteriaMessage } from './criteria'
import { codebookLockedMessage } from '../rounds/preconditions'
import { NotesPerResponse } from './criteria-summary'
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

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Mover o ${label.toLocaleLowerCase('pt-BR')} ${index + 1} para cima`}
                      disabled={index === 0}
                      onClick={() => onChange(moveBy(criteria, index, -1))}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Mover o ${label.toLocaleLowerCase('pt-BR')} ${index + 1} para baixo`}
                      disabled={index === criteria.length - 1}
                      onClick={() => onChange(moveBy(criteria, index, 1))}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        onChange(criteria.filter((c) => c.key !== criterion.key))
                      }
                    >
                      Remover
                    </Button>
                  </div>
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
}: {
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  defaultType: DefinitionType | null
  note: string
  inPhase2: boolean
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    toRows(definitions, criteria, defaultType),
  )
  const [general, setGeneral] = useState<CriterionRow[]>(() =>
    toCriterionRows(criteria.filter((criterion) => criterion.definitionId === null)),
  )

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

  return (
    <>
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

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Mover a definição ${index + 1} para cima`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Mover a definição ${index + 1} para baixo`}
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </Button>
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

      {inPhase2 ? (
        <>
          <Card padding="sm">
            <h3 className="m-0 text-sm font-bold text-ink">Critérios gerais</h3>
            <p className="m-0 mt-1 mb-3 text-[13px] text-muted">
              Valem para todas as definições da versão de uma vez. Editar ou remover um
              critério geral vale para todas elas.
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

          <NotesPerResponse
            definitions={rows.map((row) => ({ id: String(row.key) }))}
            criteria={[
              ...rows.flatMap((row) =>
                row.criteria.map(() => ({ definitionId: String(row.key) })),
              ),
              ...general.map(() => ({ definitionId: null })),
            ]}
          />

          {uncovered.length > 0 ? (
            <Alert tone="notice">
              {missingCriteriaMessage(
                uncovered.map((row, index) => row.title || `sem título ${index + 1}`),
              )}
            </Alert>
          ) : null}
        </>
      ) : null}

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
      <TypeLegend />
      {definitions.length === 0 ? (
        <EmptyState>Esta versão não tem definições.</EmptyState>
      ) : (
        <>
          <DefinitionList definitions={definitions} criteria={criteria} />
          {inPhase2 ? (
            <NotesPerResponse definitions={definitions} criteria={criteria} />
          ) : null}
        </>
      )}
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
