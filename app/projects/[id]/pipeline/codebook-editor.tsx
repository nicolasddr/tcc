'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import { saveCodebook, type CodebookState } from './actions'
import { isEditing, savedNonceOf } from './editing'
import type {
  CodebookCriterion,
  CodebookDefinition,
  CodebookVersion,
} from './codebook'
import {
  DEFINITION_TYPE_OPTIONS,
  definitionTypeLabel,
  type DefinitionType,
} from '@/app/projects/definition-types'
import { Button, buttonClass } from '@/app/components/ui/button'
import { RowActions, RowMenuItem } from '@/app/components/ui/row-actions'
import { Disclosure } from '@/app/components/ui/disclosure'
import { EditableRow } from '@/app/components/ui/editable-row'
import { Badge } from '@/app/components/ui/badge'
import { Field, Input, Select, Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { SaveBar } from '@/app/components/ui/save-bar'
import { Card } from '@/app/components/ui/card'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { preWrapClass } from '@/app/components/ui/prose'
import { Alert } from '@/app/components/ui/alert'
import { LockIcon } from '@/app/components/ui/icons'
import { VersionStatus } from './version-status'
import { DefinitionList } from './definition-list'
import { EmptyState } from '@/app/components/ui/empty-state'
import { moveBy } from '@/lib/reorder'
import { plural } from '@/lib/plural'
import { PHASE_2 } from './preconditions'
import {
  PER_RESPONSE_CRITERIA_LABEL,
  criteriaOfDefinition,
  definitionsWithoutCriteria,
  generalCriteria,
  missingCriteriaMessage,
  ownCriteria,
  perResponseCriteria,
  type CriterionScope,
} from './criteria'
import { codebookLockedMessage } from '../(tabs)/rounds/preconditions'
import { isFrozen } from './freeze'
import { FrozenNotice } from './frozen-notice'
import { CodebookSummary } from './criteria-summary'
import { SCALE, scaleLabel, type ScaleValue } from '../(tabs)/evaluate/scale'
import { ScaleMarker } from '../(tabs)/evaluate/scale-marker'
import {
  CODEBOOK_NOTE_MAX,
  CRITERION_DESCRIPTION_MAX,
  CRITERION_NAME_MAX,
  DEFINITION_DESCRIPTION_MAX,
  DEFINITION_TITLE_MAX,
  LEVEL_DESCRIPTION_MAX,
} from '@/lib/limits'

const initialState: CodebookState = null

type CriterionRow = {
  key: number
  name: string
  description: string
  levels: Record<ScaleValue, string>
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
  return {
    key: nextKey++,
    name: '',
    description: '',
    levels: { high: '', medium: '', low: '' },
  }
}

function toCriterionRows(criteria: CodebookCriterion[]): CriterionRow[] {
  return criteria.map((criterion) => ({
    key: nextKey++,
    name: criterion.name,
    description: criterion.description ?? '',
    levels: {
      high: criterion.levels.high ?? '',
      medium: criterion.levels.medium ?? '',
      low: criterion.levels.low ?? '',
    },
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

export function serializeCriteria(criteria: readonly CriterionRow[]): string {
  return JSON.stringify(
    criteria.map((criterion) => [
      criterion.name.trim(),
      criterion.description.trim(),
      ...SCALE.map((level) => criterion.levels[level].trim()),
    ]),
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

export function changesLabel(
  changedDefinitions: number,
  generalChanged: boolean,
  perResponseChanged: boolean,
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
  if (perResponseChanged) parts.push('critérios por resposta alterados')
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

export const ORDER_HELP =
  'A ordem em que as definições aparecem para a equipe e vão à LLM. Reordene pelas ' +
  'setas; a ordem é salva com a versão.'

const DESCRIPTION_HELP =
  'O texto que o avaliador lê para entender o que o título quis dizer. Salvar sem ' +
  'descrição é permitido.'

const PER_RESPONSE_HELP =
  'Valem para a resposta inteira, e não para uma definição: cada um rende uma nota só por resposta.'

const LEVELS_HELP = 'Aparece para o avaliador ao passar o mouse no botão do nível.'

const NOTE_HELP =
  'Fica presa a esta versão e aparece no histórico. Salvar sem observação é permitido.'

function SectionTitle({ title, help }: { title: string; help: string }) {
  return (
    <h3 className="m-0 flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">
      {title}
      <InfoTooltip text={help} />
    </h3>
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

function NoDefinitionsYet({
  inPhase2,
  onAdd,
}: {
  inPhase2: boolean
  onAdd?: () => void
}) {
  return (
    <EmptyState>
      <span className="block">Nenhuma definição ainda.</span>
      {inPhase2 ? null : (
        <span className="mt-1 block">
          Na Fase 1 bastam título e tipo; a descrição e os critérios entram na Fase 2.
        </span>
      )}
      {onAdd ? (
        <span className="mt-4 block">
          <Button onClick={onAdd}>Adicionar definições</Button>
        </span>
      ) : null}
    </EmptyState>
  )
}

function CodebookBody({
  hasVersion,
  definitions,
  criteria,
  inPhase2,
  onAdd,
}: {
  hasVersion: boolean
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  inPhase2: boolean
  onAdd?: () => void
}) {
  return (
    <>
      {inPhase2 && definitions.length > 0 ? (
        <CodebookSummary definitions={definitions} criteria={criteria} />
      ) : null}
      <TypeLegend />
      {definitions.length === 0 && !hasVersion ? (
        <NoDefinitionsYet inPhase2={inPhase2} onAdd={onAdd} />
      ) : definitions.length === 0 ? (
        <EmptyState>Esta versão não tem definições.</EmptyState>
      ) : (
        <DefinitionList definitions={definitions} criteria={criteria} />
      )}
    </>
  )
}

function LevelFields({
  levels,
  onChange,
}: {
  levels: Record<ScaleValue, string>
  onChange: (next: Record<ScaleValue, string>) => void
}) {
  const filled = SCALE.filter((level) => levels[level].trim() !== '').length

  return (
    <Disclosure
      className="mt-2.5"
      defaultOpen={filled > 0}
      summary={
        <>
          Descrição dos níveis (opcional) · {filled} de {SCALE.length}
          <InfoTooltip text={LEVELS_HELP} />
        </>
      }
    >
      <div className="mt-2 flex flex-col gap-2.5">
        {SCALE.map((level) => (
          <Field
            key={level}
            label={
              <span className="inline-flex items-center gap-1.5">
                <ScaleMarker value={level} />
                {scaleLabel(level)}
              </span>
            }
          >
            <Textarea
              name={`criterion_level_${level}`}
              rows={2}
              maxLength={LEVEL_DESCRIPTION_MAX}
              value={levels[level]}
              onChange={(e) => onChange({ ...levels, [level]: e.target.value })}
            />
          </Field>
        ))}
      </div>
    </Disclosure>
  )
}

function CriterionFields({
  scope,
  criteria,
  label,
  addLabel,
  emptyHint,
  required,
  onChange,
}: {
  scope: string
  criteria: CriterionRow[]
  label: string
  addLabel: string
  emptyHint: string
  required: boolean
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
                    required={required}
                    className="min-w-[220px] flex-1"
                  >
                    <Input
                      type="text"
                      name="criterion_name"
                      required={required}
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
                      placeholder="Ex.: a resposta indica de onde veio a informação."
                    />
                  </Field>
                </div>

                <LevelFields
                  levels={criterion.levels}
                  onChange={(levels) => update(criterion.key, { levels })}
                />
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

const GENERAL_ANCHOR = 'criterios-gerais'

function definitionScopes(
  definitionId: string,
  own: readonly CriterionRow[],
  general: readonly CriterionRow[],
): CriterionScope[] {
  return [
    ...own.map(() => ({ definitionId, scope: 'specific' as const })),
    ...general.map(() => ({ definitionId: null, scope: 'general' as const })),
  ]
}

function notesLabel(ownCount: number, generalCount: number): string {
  const total = ownCount + generalCount
  return `Esta definição vale ${plural(total, 'nota', 'notas')} por resposta: ${plural(
    ownCount,
    'própria',
    'próprias',
  )} + ${plural(generalCount, 'geral', 'gerais')}.`
}

function InheritedCriteria({ criteria }: { criteria: CriterionRow[] }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong px-[14px] py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="text-[13px] font-semibold text-label">
          Herdados dos critérios gerais · {criteria.length}
        </span>
        <a href={`#${GENERAL_ANCHOR}`} className={buttonClass('link')}>
          Editar os gerais
        </a>
      </div>

      {criteria.length === 0 ? (
        <p className="m-0 mt-2 text-[13px] text-muted">
          Nenhum critério geral nesta versão.
        </p>
      ) : (
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {criteria.map((criterion, index) => (
            <li key={criterion.key}>
              <span className="text-[13px] font-semibold text-ink">
                {criterion.name.trim() || `Critério geral ${index + 1}`}
              </span>
              {criterion.description.trim() ? (
                <p className={`m-0 mt-1 text-[13px] ${preWrapClass} text-muted`}>
                  {criterion.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CodebookFields({
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
    general: toCriterionRows(generalCriteria(criteria)),
    perResponse: toCriterionRows(perResponseCriteria(criteria)),
    note,
  }))
  const [rows, setRows] = useState<Row[]>(initial.rows)
  const [general, setGeneral] = useState<CriterionRow[]>(initial.general)
  const [perResponse, setPerResponse] = useState<CriterionRow[]>(initial.perResponse)
  const [noteText, setNoteText] = useState(initial.note)
  const [expandedKey, setExpandedKey] = useState<number | null>(
    () => initial.rows.find((row) => row.title.trim() === '')?.key ?? null,
  )

  function toggle(key: number) {
    setExpandedKey((current) => (current === key ? null : key))
  }

  function add() {
    const row = newRow(defaultType)
    setRows((current) => [...current, row])
    setExpandedKey(row.key)
  }

  function remove(key: number) {
    setRows((current) => current.filter((row) => row.key !== key))
    setExpandedKey((current) => (current === key ? null : current))
  }

  function update(key: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  function move(index: number, offset: number) {
    setRows((current) => moveBy(current, index, offset))
  }

  const summaryCriteria: CriterionScope[] = [
    ...rows.flatMap((row) =>
      row.criteria.map(() => ({ definitionId: String(row.key), scope: 'specific' as const })),
    ),
    ...general.map(() => ({ definitionId: null, scope: 'general' as const })),
    ...perResponse.map(() => ({ definitionId: null, scope: 'per_response' as const })),
  ]

  const uncovered = definitionsWithoutCriteria(
    rows.map((row) => ({ id: String(row.key), title: row.title })),
    summaryCriteria,
  )

  const changedDefinitions = countChanged(
    initial.rows.map(serializeRow),
    rows.map(serializeRow),
  )
  const generalChanged =
    serializeCriteria(initial.general) !== serializeCriteria(general)
  const perResponseChanged =
    serializeCriteria(initial.perResponse) !== serializeCriteria(perResponse)
  const noteChanged = initial.note.trim() !== noteText.trim()
  const dirty =
    changedDefinitions > 0 || generalChanged || perResponseChanged || noteChanged

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
    setPerResponse(initial.perResponse)
    setNoteText(initial.note)
    onDone()
  }

  const summaryDefinitions = rows.map((row) => ({ id: String(row.key) }))

  return (
    <>
      {inPhase2 ? (
        <CodebookSummary
          definitions={summaryDefinitions}
          criteria={summaryCriteria}
        />
      ) : null}

      <Card padding="sm">
        {rows.length === 0 ? (
          <EmptyState>
            Nenhuma definição na lista. Adicione ao menos uma para poder salvar.
          </EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {rows.map((row, index) => {
              const expanded = expandedKey === row.key
              const id = String(row.key)
              const scopes = definitionScopes(id, row.criteria, general)
              const own = ownCriteria(id, scopes).length
              const applicable = criteriaOfDefinition(id, scopes).length
              const typeLabel = row.type ? definitionTypeLabel(row.type) : null

              return (
                <li key={row.key}>
                  <EditableRow
                    expanded={expanded}
                    onToggle={() => toggle(row.key)}
                    collapseLabel="Recolher"
                    title={
                      <>
                        <span className="mr-2 tabular-nums text-muted">{index + 1}</span>
                        {row.title.trim() || 'Definição sem título'}
                      </>
                    }
                    meta={
                      inPhase2
                        ? plural(own, 'critério próprio', 'critérios próprios')
                        : null
                    }
                    badges={
                      <>
                        {inPhase2 && own === 0 && applicable > 0 ? (
                          <Badge tone="warning">Sem critério próprio</Badge>
                        ) : null}
                        {typeLabel ? <Badge tone="accent">{typeLabel}</Badge> : null}
                      </>
                    }
                    actions={
                      <RowActions
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
                        <RowMenuItem onClick={() => remove(row.key)}>Remover</RowMenuItem>
                      </RowActions>
                    }
                    footer={inPhase2 ? notesLabel(own, applicable - own) : null}
                  >
                    <div className="flex flex-wrap items-end gap-3">
                      <Field
                        label={`Título da definição ${index + 1}`}
                        required={expanded}
                        className="min-w-[220px] flex-[2]"
                      >
                        <Input
                          type="text"
                          name="definition_title"
                          required={expanded}
                          maxLength={DEFINITION_TITLE_MAX}
                          value={row.title}
                          onChange={(e) => update(row.key, { title: e.target.value })}
                          placeholder="Ex.: Informacional"
                        />
                      </Field>

                      <Field label="Tipo (opcional)" className="min-w-[200px] flex-1">
                        <Select
                          name="definition_type"
                          value={row.type}
                          onChange={(e) =>
                            update(row.key, { type: e.target.value as DefinitionType })
                          }
                        >
                          <option value="">Sem tipo</option>
                          {DEFINITION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    {inPhase2 ? (
                      <>
                        <Field
                          label={`Descrição da definição ${index + 1} (opcional)`}
                          tooltip={DESCRIPTION_HELP}
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

                        <div className="border-t border-line pt-3">
                          <CriterionFields
                            scope={String(index)}
                            criteria={row.criteria}
                            label="Nome do critério"
                            addLabel="Adicionar critério"
                            emptyHint="Nenhum critério próprio nesta definição. Ela também recebe os critérios gerais da versão."
                            required={expanded}
                            onChange={(next) => update(row.key, { criteria: next })}
                          />
                        </div>

                        <InheritedCriteria criteria={general} />
                      </>
                    ) : null}
                  </EditableRow>
                </li>
              )
            })}
          </ul>
        )}

        <FormActions align="start" className="mt-3">
          <Button variant="secondary" size="sm" onClick={add}>
            Adicionar definição
          </Button>
          <InfoTooltip text={ORDER_HELP} label="Sobre a ordem das definições" />
        </FormActions>

        {inPhase2 && uncovered.length > 0 ? (
          <Alert tone="notice" className="mt-3">
            {missingCriteriaMessage(
              uncovered.map((row, index) => row.title || `sem título ${index + 1}`),
            )}
          </Alert>
        ) : null}
      </Card>

      {inPhase2 ? (
        <div id={GENERAL_ANCHOR} className="scroll-mt-4">
          <Card padding="sm">
            <SectionTitle
              title="Critérios gerais"
              help={generalScopeLabel(rows.length)}
            />
            <div className="mt-3">
              <CriterionFields
                scope="general"
                criteria={general}
                label="Nome do critério geral"
                addLabel="Adicionar critério geral"
                emptyHint="Nenhum critério geral nesta versão."
                required
                onChange={setGeneral}
              />
            </div>
          </Card>
        </div>
      ) : null}

      {inPhase2 ? (
        <Card padding="sm">
          <SectionTitle title={PER_RESPONSE_CRITERIA_LABEL} help={PER_RESPONSE_HELP} />
          <div className="mt-3">
            <CriterionFields
              scope="per_response"
              criteria={perResponse}
              label="Nome do critério por resposta"
              addLabel="Adicionar critério por resposta"
              emptyHint="Nenhum critério por resposta nesta versão."
              required
              onChange={setPerResponse}
            />
          </div>
        </Card>
      ) : null}

      <Field label="Observação desta versão (opcional)" tooltip={NOTE_HELP}>
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

      <SaveBar
        dirty={dirty}
        changes={changesLabel(
          changedDefinitions,
          generalChanged,
          perResponseChanged,
          noteChanged,
        )}
        onDiscard={discard}
        loading={pending}
        loadingText="Salvando…"
      />
    </>
  )
}

function CodebookReadOnly({
  version,
  isOpen,
  notice,
  definitions,
  criteria,
  inPhase2,
}: {
  version: CodebookVersion | null
  isOpen: boolean
  notice: React.ReactNode
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
  inPhase2: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <VersionStatus version={version} isOpen={isOpen} />
      {notice}
      <CodebookBody
        hasVersion={version !== null}
        definitions={definitions}
        criteria={criteria}
        inPhase2={inPhase2}
      />
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
  const [editingNonce, setEditingNonce] = useState<number | null>(null)
  const editing = isEditing(state, editingNonce)

  const notice = isFrozen(phase) ? (
    <FrozenNotice subject="codebook" projectId={projectId} />
  ) : openRoundNumber !== null ? (
    <Alert tone="neutral" icon={<LockIcon />}>
      {codebookLockedMessage(openRoundNumber)}
    </Alert>
  ) : null

  if (notice !== null) {
    return (
      <CodebookReadOnly
        version={version}
        isOpen={isOpen}
        notice={notice}
        definitions={definitions}
        criteria={criteria}
        inPhase2={inPhase2}
      />
    )
  }

  if (!editing) {
    const startEditing = () => setEditingNonce(savedNonceOf(state))
    const empty = version === null && definitions.length === 0

    return (
      <div className="flex flex-col gap-4">
        <VersionStatus
          version={version}
          isOpen={isOpen}
          action={
            empty ? null : (
              <Button variant="secondary" size="sm" onClick={startEditing}>
                Editar
              </Button>
            )
          }
        />
        <CodebookBody
          hasVersion={version !== null}
          definitions={definitions}
          criteria={criteria}
          inPhase2={inPhase2}
          onAdd={startEditing}
        />
        {saved ? <Alert tone="success">Definições salvas.</Alert> : null}
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
