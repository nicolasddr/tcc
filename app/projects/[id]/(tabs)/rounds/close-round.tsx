'use client'

import { useActionState, useEffect, useRef } from 'react'
import { closeRound, type CloseRoundState } from './actions'
import {
  closeConfirmationLines,
  codebookLockedMessage,
  openRoundSummary,
  pendingEvaluatorsTitle,
  roundInputSummary,
} from './preconditions'
import { Alert } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { Chip } from '@/app/components/ui/chip'
import { InfoTooltip } from '@/app/components/ui/tooltip'

const initialState: CloseRoundState = null

const dialogClass =
  'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface ' +
  'p-0 text-ink backdrop:bg-black/40'

export function CloseRound({
  projectId,
  round,
  evaluatorsNotFinished,
  codebookVersionNumber,
  promptVersionNumber,
}: {
  projectId: string
  round: { id: string; roundNumber: number; phase: number }
  evaluatorsNotFinished: string[]
  codebookVersionNumber: number | null
  promptVersionNumber: number | null
}) {
  const [state, action, pending] = useActionState(closeRound, initialState)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (state) dialog.current?.close()
  }, [state])

  return (
    <div className="flex flex-col gap-3">
      <Card tone="subtle" padding="sm">
        <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span>
            {openRoundSummary(
              round.roundNumber,
              codebookVersionNumber,
              promptVersionNumber,
            )}
          </span>
          <InfoTooltip text={codebookLockedMessage(round.roundNumber)} />
        </p>
        <p className="m-0 mt-1.5 text-[13px] text-muted">
          {roundInputSummary(round.phase)}
        </p>
      </Card>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

      <div>
        <Button
          variant="dangerSolid"
          onClick={() => dialog.current?.showModal()}
          loading={pending}
          loadingText="Fechando…"
        >
          Fechar rodada {round.roundNumber}
        </Button>
      </div>

      <dialog ref={dialog} className={dialogClass} aria-labelledby="fechar-rodada-titulo">
        <div className="flex flex-col gap-4 p-5">
          <h3 id="fechar-rodada-titulo" className="m-0 text-[15px] font-bold text-ink">
            Fechar a rodada {round.roundNumber}?
          </h3>

          <div className="flex flex-col gap-1.5 text-[13px] leading-[1.6] text-muted">
            {closeConfirmationLines(round.roundNumber).map((line) => (
              <p key={line} className="m-0">
                {line}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="m-0 text-[13px] font-semibold text-ink">
              {pendingEvaluatorsTitle(evaluatorsNotFinished.length)}
            </p>

            {evaluatorsNotFinished.length > 0 ? (
              <ul className="m-0 flex max-h-40 list-none flex-wrap gap-1.5 overflow-y-auto p-0">
                {evaluatorsNotFinished.map((name) => (
                  <li key={name} className="flex">
                    <Chip>{name}</Chip>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => dialog.current?.close()}
              disabled={pending}
            >
              Cancelar
            </Button>

            <form action={action}>
              <input type="hidden" name="project_id" value={projectId} />
              <Button
                type="submit"
                variant="dangerSolid"
                loading={pending}
                loadingText="Fechando…"
              >
                Confirmar fechamento
              </Button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  )
}
