'use client'

import { useActionState } from 'react'
import { createRound, type NewRoundState } from './actions'
import {
  codebookLockedMessage,
  roundBlockerMessage,
  roundBlockerSummary,
  type RoundBlocker,
} from './preconditions'
import { Alert } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { InfoTooltip } from '@/app/components/ui/tooltip'

const initialState: NewRoundState = null

const FREEZE_HELP =
  'As duas versões congelam na mesma operação que cria a rodada: a partir dali elas ' +
  'não mudam mais, e a alteração seguinte cria a versão seguinte. É por isso que a ' +
  'rodada é a unidade de dado de pesquisa: tudo o que ela produz aponta para um ' +
  'codebook e um prompt que não se mexem mais.'

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
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>{roundBlockerSummary(blocker)}</span>
                <InfoTooltip text={roundBlockerMessage(blocker)} />
              </span>
            </Alert>
          ))}
        </div>
      ) : (
        <Card tone="subtle" padding="sm">
          <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span>
              Esta rodada vai congelar o codebook v{codebookVersionNumber} e o prompt v
              {promptVersionNumber}.
            </span>
            <InfoTooltip text={FREEZE_HELP} />
          </p>
        </Card>
      )}

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? (
        <Alert tone="success">
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>Rodada {state.roundNumber} aberta.</span>
            <InfoTooltip text={codebookLockedMessage(state.roundNumber)} />
          </span>
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
