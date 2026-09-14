'use client'

import { useActionState, useState } from 'react'
import { submitEvaluation, type EvaluationState } from './actions'
import {
  cellKey,
  definitionsIncomplete,
  incompleteMessage,
  isComplete,
  type Answer,
} from './completeness'
import { SCALE, isScaleValue, scaleLabel, scaleTone, type ScaleValue } from './scale'
import type { SubmittedEvaluation } from './evaluation'
import type { CodebookCriterion, CodebookDefinition } from '../../pipeline/codebook'
import type { CodebookCell } from '../../pipeline/criteria'
import type { ResponseDetail } from '../../pipeline/responses'
import { JUSTIFICATION_MAX } from '@/lib/limits'
import { formatDate } from '@/app/notifications/labels'
import { Alert } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'
import { Button, buttonClass } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { Disclosure } from '@/app/components/ui/disclosure'
import { Textarea } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { preWrapClass } from '@/app/components/ui/prose'
import { InfoTooltip } from '@/app/components/ui/tooltip'

type Cell = CodebookCell<CodebookDefinition, CodebookCriterion>

type Group = { definition: CodebookDefinition; cells: Cell[] }

const initialState: EvaluationState = null

const selected: Record<ScaleValue, string> = {
  high: 'border-current bg-success-bg text-success-fg',
  medium: 'border-current bg-warning-bg text-warning-fg',
  low: 'border-current bg-danger-bg text-danger-fg',
}

function keyOf(cell: Cell): string {
  return cellKey({ definitionId: cell.definition.id, criterionId: cell.criterion.id })
}

function groupByDefinition(cells: readonly Cell[]): Group[] {
  const groups: Group[] = []

  for (const cell of cells) {
    const last = groups[groups.length - 1]
    if (last && last.definition.id === cell.definition.id) last.cells.push(cell)
    else groups.push({ definition: cell.definition, cells: [cell] })
  }

  return groups
}

function storedValues(submitted: SubmittedEvaluation | null): Record<string, string> {
  const values: Record<string, string> = {}
  for (const score of submitted?.scores ?? []) values[cellKey(score)] = score.value
  return values
}

function storedJustifications(
  submitted: SubmittedEvaluation | null,
): Record<string, string> {
  const texts: Record<string, string> = {}
  for (const score of submitted?.scores ?? []) {
    texts[cellKey(score)] = score.justification ?? ''
  }
  return texts
}

function CriterionName({ criterion, isGeneral }: { criterion: CodebookCriterion; isGeneral: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-semibold text-ink">{criterion.name}</span>
      {criterion.description ? <InfoTooltip text={criterion.description} /> : null}
      {isGeneral ? <Badge tone="info">geral</Badge> : null}
    </span>
  )
}

function DefinitionSummary({
  definition,
  scored,
  total,
}: {
  definition: CodebookDefinition
  scored: number
  total: number
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-ink">{definition.title}</span>
      {definition.description ? <InfoTooltip text={definition.description} /> : null}
      <Badge tone={scored === total ? 'success' : 'neutral'}>
        {scored} de {total}
      </Badge>
    </span>
  )
}

function ResponseCard({ response }: { response: ResponseDetail }) {
  return (
    <Card tone="subtle" padding="sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ink">{response.itemName}</span>
        <span className="text-[13px] text-muted">{formatDate(response.createdAt)}</span>
      </div>
      <p className={`m-0 mt-2 text-sm ${preWrapClass} text-ink`}>{response.text}</p>
    </Card>
  )
}

export function EvaluationForm({
  projectId,
  roundNumber,
  response,
  cells,
  submitted,
}: {
  projectId: string
  roundNumber: number
  response: ResponseDetail
  cells: Cell[]
  submitted: SubmittedEvaluation | null
}) {
  const [state, action, pending] = useActionState(submitEvaluation, initialState)
  const [values, setValues] = useState(() => storedValues(submitted))
  const [justifications, setJustifications] = useState(() =>
    storedJustifications(submitted),
  )

  const groups = groupByDefinition(cells)
  const answers: Answer[] = cells.map((cell) => {
    const key = keyOf(cell)
    return {
      definitionId: cell.definition.id,
      criterionId: cell.criterion.id,
      value: values[key] ?? '',
      justification: justifications[key] ?? '',
    }
  })

  const sent = state !== null && 'ok' in state
  const reading = submitted !== null || sent

  function scoredIn(group: Group): number {
    return group.cells.filter((cell) => isScaleValue(values[keyOf(cell)])).length
  }

  if (reading) {
    return (
      <div className="flex flex-col gap-4">
        <ResponseCard response={response} />

        {sent ? <Alert tone="success">Avaliação enviada.</Alert> : null}

        <p className="m-0 text-[13px] text-muted">
          {submitted ? `Enviada em ${formatDate(submitted.submittedAt)}. ` : null}
          O envio é definitivo: as notas e as justificativas desta resposta não mudam
          mais.
        </p>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {groups.map((group) => (
            <li key={group.definition.id}>
              <Card padding="sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {group.definition.title}
                  </span>
                  {group.definition.description ? (
                    <InfoTooltip text={group.definition.description} />
                  ) : null}
                </span>

                <ul className="m-0 mt-3 flex list-none flex-col gap-3 border-t border-line p-0 pt-3">
                  {group.cells.map((cell) => {
                    const key = keyOf(cell)
                    const value = values[key]
                    const justification = justifications[key] ?? ''

                    return (
                      <li key={key} className="flex flex-col gap-1.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <CriterionName
                            criterion={cell.criterion}
                            isGeneral={cell.isGeneral}
                          />
                          {isScaleValue(value) ? (
                            <Badge tone={scaleTone(value)}>{scaleLabel(value)}</Badge>
                          ) : null}
                        </span>
                        <p className={`m-0 text-[13px] ${preWrapClass} text-muted`}>
                          {justification === '' ? 'Sem justificativa.' : justification}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const missing = definitionsIncomplete(cells, answers).map(
    (definition) => definition.title,
  )
  const complete = isComplete(cells, answers)
  const error = state !== null && 'error' in state ? state.error : null

  return (
    <Form action={action} gap="sm">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="response_id" value={response.id} />

      <ResponseCard response={response} />

      <p className="m-0 text-[13px] text-muted">
        Dê uma nota em cada critério de cada definição, com justificativa opcional. O
        envio é definitivo: depois de enviar, esta avaliação da rodada {roundNumber} fica
        em leitura.
      </p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {groups.map((group) => (
          <li key={group.definition.id}>
            <Card padding="sm">
              <Disclosure
                defaultOpen
                summaryClassName=""
                summary={
                  <DefinitionSummary
                    definition={group.definition}
                    scored={scoredIn(group)}
                    total={group.cells.length}
                  />
                }
              >
                <ul className="m-0 mt-3 flex list-none flex-col gap-4 border-t border-line p-0 pt-3">
                  {group.cells.map((cell) => {
                    const key = keyOf(cell)
                    const value = values[key] ?? ''

                    return (
                      <li key={key} className="flex flex-col gap-2">
                        <CriterionName
                          criterion={cell.criterion}
                          isGeneral={cell.isGeneral}
                        />

                        <input type="hidden" name={`score_${key}`} value={value} />

                        <div
                          role="group"
                          aria-label={`Nota de ${cell.criterion.name}`}
                          className="flex flex-wrap gap-2"
                        >
                          {SCALE.map((option) => {
                            const active = value === option
                            return (
                              <button
                                key={option}
                                type="button"
                                aria-pressed={active}
                                disabled={pending}
                                onClick={() =>
                                  setValues((current) => ({
                                    ...current,
                                    [key]: active ? '' : option,
                                  }))
                                }
                                className={buttonClass('secondary', {
                                  size: 'sm',
                                  className: active ? selected[option] : undefined,
                                })}
                              >
                                {scaleLabel(option)}
                              </button>
                            )
                          })}
                        </div>

                        <Textarea
                          name={`justification_${key}`}
                          rows={2}
                          maxLength={JUSTIFICATION_MAX}
                          disabled={pending}
                          aria-label={`Justificativa de ${cell.criterion.name}`}
                          placeholder="Justificativa (opcional)"
                          value={justifications[key] ?? ''}
                          onChange={(event) =>
                            setJustifications((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              </Disclosure>
            </Card>
          </li>
        ))}
      </ul>

      {error && !pending ? <Alert tone="error">{error}</Alert> : null}

      <FormActions align="start">
        <Button type="submit" loading={pending} loadingText="Enviando…" disabled={!complete}>
          Enviar avaliação
        </Button>
        <span className="text-[13px] text-muted">
          {complete
            ? 'Tudo preenchido. O envio é definitivo e não tem como editar depois.'
            : incompleteMessage(missing)}
        </span>
      </FormActions>
    </Form>
  )
}
