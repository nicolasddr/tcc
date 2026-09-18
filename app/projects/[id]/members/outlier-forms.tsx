'use client'

import { useActionState } from 'react'
import {
  markOutlier,
  unmarkOutlier,
  type OutlierState,
} from '../(tabs)/rounds/outlier-actions'
import { OUTLIER_REASON_MAX } from '@/lib/limits'
import { SubmitButton } from '@/app/components/submit-button'
import { Alert } from '@/app/components/ui/alert'
import { Field, Textarea } from '@/app/components/ui/field'

const initialState: OutlierState = null

export function MarkOutlierForm({
  projectId,
  roundId,
  projectMemberId,
  evaluatorName,
  roundNumber,
}: {
  projectId: string
  roundId: string
  projectMemberId: string
  evaluatorName: string
  roundNumber: number
}) {
  const [state, action] = useActionState(markOutlier, initialState)

  return (
    <form action={action} className="mt-2 flex flex-col gap-2.5">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="round_id" value={roundId} />
      <input type="hidden" name="project_member_id" value={projectMemberId} />

      <Field
        label={`Por que as notas de ${evaluatorName} saem do cálculo da rodada ${roundNumber}?`}
        required
        hint={`Até ${OUTLIER_REASON_MAX} caracteres. A justificativa fica registrada com o seu nome e a data, e aparece no histórico da rodada.`}
      >
        <Textarea
          name="reason"
          rows={3}
          required
          maxLength={OUTLIER_REASON_MAX}
          placeholder="Ex.: avaliou as respostas antes do treinamento da rodada."
        />
      </Field>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

      <span>
        <SubmitButton size="sm" pendingText="Marcando…">
          Marcar como outlier
        </SubmitButton>
      </span>
    </form>
  )
}

export function UnmarkOutlierForm({
  projectId,
  roundId,
  markId,
  evaluatorName,
  roundNumber,
}: {
  projectId: string
  roundId: string
  markId: string
  evaluatorName: string
  roundNumber: number
}) {
  const [state, action] = useActionState(unmarkOutlier, initialState)

  return (
    <form
      action={action}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (
          !confirm(
            `Remover a marca de outlier de ${evaluatorName} na rodada ${roundNumber}? As notas dela voltam a entrar no cálculo imediatamente. A marcação não é apagada: fica no histórico da rodada, com quem removeu e quando.`,
          )
        )
          e.preventDefault()
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="round_id" value={roundId} />
      <input type="hidden" name="mark_id" value={markId} />

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

      <span>
        <SubmitButton variant="danger" size="sm" pendingText="Removendo…">
          Remover a marca
        </SubmitButton>
      </span>
    </form>
  )
}
