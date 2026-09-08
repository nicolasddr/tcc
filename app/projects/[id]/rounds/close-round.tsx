'use client'

import { useActionState, useEffect, useRef } from 'react'
import { closeRound, type CloseRoundState } from './actions'
import { closeConfirmationLines } from './preconditions'
import { Alert } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'

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
  round: { id: string; roundNumber: number }
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
        <p className="m-0 text-[13px] text-muted">
          A rodada {round.roundNumber} está aberta sobre o codebook v
          {codebookVersionNumber} e o prompt v{promptVersionNumber}, que já congelaram.
          Enquanto ela estiver aberta, o codebook fica em leitura e não é possível abrir
          outra rodada.
        </p>
      </Card>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          variant="danger"
          onClick={() => dialog.current?.showModal()}
          loading={pending}
          loadingText="Fechando…"
        >
          Fechar rodada {round.roundNumber}
        </Button>
        <span className="text-[13px] text-muted">
          Fechar é irreversível e pede confirmação antes de mudar qualquer coisa.
        </span>
      </div>

      <dialog ref={dialog} className={dialogClass} aria-labelledby="fechar-rodada-titulo">
        <div className="flex flex-col gap-4 p-5">
          <h3 id="fechar-rodada-titulo" className="m-0 text-[15px] font-bold text-ink">
            Fechar a rodada {round.roundNumber}?
          </h3>

          <div className="flex flex-col gap-2 text-[13px] leading-[1.6] text-muted">
            {closeConfirmationLines(round.roundNumber, evaluatorsNotFinished).map(
              (line) => (
                <p key={line} className="m-0">
                  {line}
                </p>
              ),
            )}
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
                Confirmar fechamento
              </Button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  )
}
