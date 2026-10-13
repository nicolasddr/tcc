'use client'

import { useActionState } from 'react'
import {
  markOutlier,
  unmarkOutlier,
  type OutlierState,
} from '../rounds/outlier-actions'
import { OUTLIER_REASON_MAX } from '@/lib/limits'
import { SubmitButton } from '@/app/components/submit-button'
import { Alert } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import { ConfirmDialog, DialogLines } from '@/app/components/ui/confirm-dialog'
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
    <div className="flex flex-col gap-2">
      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

      <ConfirmDialog
        trigger={(open) => (
          <span>
            <Button variant="danger" size="sm" onClick={open}>
              Remover a marca
            </Button>
          </span>
        )}
        title={`Remover a marca de outlier de ${evaluatorName}?`}
        confirmLabel="Remover a marca"
        pendingLabel="Removendo…"
        action={action}
        fields={{ project_id: projectId, round_id: roundId, mark_id: markId }}
      >
        <DialogLines
          lines={[
            `As notas dela na rodada ${roundNumber} voltam a entrar no cálculo imediatamente.`,
            'A marcação não é apagada: fica no histórico da rodada, com quem removeu e quando.',
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}
