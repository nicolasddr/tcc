'use client'

import { useActionState } from 'react'
import { createRound, type NewRoundState } from './actions'
import { roundBlockerMessage, type RoundBlocker } from './preconditions'
import { Alert } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'

const initialState: NewRoundState = null

export function NewRound({
  projectId,
  blockers,
  codebookVersionNumber,
  promptVersionNumber,
}: {
  projectId: string
  blockers: RoundBlocker[]
  codebookVersionNumber: number | null
  promptVersionNumber: number | null
}) {
  const [state, action, pending] = useActionState(createRound, initialState)
  const blocked = blockers.length > 0

  return (
    <div className="flex flex-col gap-3">
      {blocked ? (
        <div className="flex flex-col gap-2">
          {blockers.map((blocker) => (
            <Alert key={blocker.key} tone="notice">
              {roundBlockerMessage(blocker)}
            </Alert>
          ))}
        </div>
      ) : (
        <Card tone="subtle" padding="sm">
          <p className="m-0 text-[13px] text-muted">
            Esta rodada vai fixar o codebook v{codebookVersionNumber} e o prompt v
            {promptVersionNumber}. As duas versões congelam na mesma operação que cria a
            rodada: a partir dali elas não mudam mais, e a alteração seguinte cria a
            versão seguinte.
          </p>
        </Card>
      )}

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? (
        <Alert tone="success">
          Rodada {state.roundNumber} aberta. O codebook fica em leitura enquanto ela
          estiver aberta.
        </Alert>
      ) : null}

      <form action={action}>
        <input type="hidden" name="project_id" value={projectId} />
        <Button
          type="submit"
          disabled={blocked}
          loading={pending}
          loadingText="Criando…"
        >
          Nova rodada
        </Button>
      </form>
    </div>
  )
}
