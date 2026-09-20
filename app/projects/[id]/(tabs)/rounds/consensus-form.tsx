'use client'

import { useActionState } from 'react'
import { saveConsensusNote, type ConsensusState } from './consensus-actions'
import type { ConsensusNote } from './consensus'
import { CONSENSUS_NOTE_MAX } from '@/lib/limits'
import { SubmitButton } from '@/app/components/submit-button'
import { Alert } from '@/app/components/ui/alert'
import { Field, Textarea } from '@/app/components/ui/field'

const initialState: ConsensusState = null

export function ConsensusForm({
  projectId,
  roundId,
  responseId,
  definitionId,
  criterionId,
  note,
  label,
  hint,
  placeholder,
  submitLabel,
  savedMessage,
  removedMessage,
}: {
  projectId: string
  roundId: string
  responseId: string
  definitionId: string
  criterionId: string
  note: ConsensusNote | null
  label: string
  hint: string
  placeholder: string
  submitLabel: string
  savedMessage: string
  removedMessage: string
}) {
  const [state, action] = useActionState(saveConsensusNote, initialState)

  return (
    <form action={action} className="mt-2 flex flex-col gap-2.5">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="round_id" value={roundId} />
      <input type="hidden" name="response_id" value={responseId} />
      <input type="hidden" name="definition_id" value={definitionId} />
      <input type="hidden" name="criterion_id" value={criterionId} />

      <Field label={label} hint={hint}>
        <Textarea
          key={note?.updatedAt ?? 'empty'}
          name="text"
          rows={4}
          maxLength={CONSENSUS_NOTE_MAX}
          defaultValue={note?.text ?? ''}
          placeholder={placeholder}
        />
      </Field>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? (
        <Alert tone="success">{state.saved ? savedMessage : removedMessage}</Alert>
      ) : null}

      <span>
        <SubmitButton size="sm" pendingText="Salvando…">
          {submitLabel}
        </SubmitButton>
      </span>
    </form>
  )
}
