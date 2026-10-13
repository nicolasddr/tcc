'use client'

import { useActionState, useEffect, useRef } from 'react'
import { closeRound, type CloseRoundState } from './actions'
import { closeConfirmationLines, pendingEvaluatorsTitle } from './preconditions'
import { Alert } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import { Chip } from '@/app/components/ui/chip'
import { dialogClass } from '@/app/components/ui/confirm-dialog'

const initialState: CloseRoundState = null

export function CloseRound({
  projectId,
  round,
  evaluatorsNotFinished,
  activeEvaluators,
}: {
  projectId: string
  round: { id: string; roundNumber: number; phase: number }
  evaluatorsNotFinished: string[]
  activeEvaluators: number
}) {
  const [state, action, pending] = useActionState(closeRound, initialState)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (state) dialog.current?.close()
  }, [state])

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          variant="danger"
          onClick={() => dialog.current?.showModal()}
          loading={pending}
          loadingText="Fechando…"
        >
          Fechar rodada {round.roundNumber}
        </Button>
      </div>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

      <dialog ref={dialog} className={dialogClass} aria-labelledby="fechar-rodada-titulo">
        <div className="flex flex-col gap-4 p-5">
          <h3 id="fechar-rodada-titulo" className="m-0 text-[15px] font-bold text-ink">
            Fechar a rodada {round.roundNumber}?
          </h3>

          <div className="flex flex-col gap-1.5 text-[13px] leading-[1.6] text-muted">
            {closeConfirmationLines(round.roundNumber, round.phase).map((line) => (
              <p key={line} className="m-0">
                {line}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="m-0 text-[13px] font-semibold text-ink">
              {pendingEvaluatorsTitle(evaluatorsNotFinished.length, activeEvaluators)}
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
              <input type="hidden" name="round_id" value={round.id} />
              <Button
                type="submit"
                variant="dangerSolid"
                loading={pending}
                loadingText="Fechando…"
              >
                Fechar rodada {round.roundNumber}
              </Button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  )
}
