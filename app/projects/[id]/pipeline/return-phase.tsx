'use client'

import { useActionState, useEffect, useRef } from 'react'
import { returnToPhase3, type ReturnPhaseState } from './actions'
import { PROJECT_PHASES } from '../phase-bar'
import { PHASE_3 } from './preconditions'
import { dialogClass } from './advance-phase'
import { Button } from '@/app/components/ui/button'
import { Alert } from '@/app/components/ui/alert'

const initialState: ReturnPhaseState = null

const titleId = 'voltar-fase-3-titulo'

export function ReturnPhase({
  projectId,
  blocked,
  hint,
  lines,
  summary,
}: {
  projectId: string
  blocked: boolean
  hint: string
  lines: readonly string[]
  summary?: React.ReactNode
}) {
  const [state, action, isPending] = useActionState(returnToPhase3, initialState)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (state) dialog.current?.close()
  }, [state])

  const error = state !== null && 'error' in state ? state.error : null
  const targetName = PROJECT_PHASES[PHASE_3 - 1]?.name

  if (state !== null && 'ok' in state) {
    return (
      <Alert tone="success" className="mt-4">
        O projeto voltou para a Fase {PHASE_3} — {targetName}. As rodadas da Fase 4
        continuam acessíveis para consulta.
      </Alert>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          variant="secondary"
          onClick={() => dialog.current?.showModal()}
          disabled={blocked}
          loading={isPending}
          loadingText="Voltando…"
        >
          Voltar à Fase {PHASE_3}
        </Button>

        <span className="text-[13px] text-muted">{hint}</span>
      </div>

      <dialog ref={dialog} className={dialogClass} aria-labelledby={titleId}>
        <div className="flex flex-col gap-4 p-5">
          <h3 id={titleId} className="m-0 text-[15px] font-bold text-ink">
            Voltar à Fase {PHASE_3} — {targetName}?
          </h3>

          {summary}

          <div className="flex flex-col gap-2 text-[13px] leading-[1.6] text-muted">
            {lines.map((line) => (
              <p key={line} className="m-0">
                {line}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => dialog.current?.close()}
              disabled={isPending}
            >
              Cancelar
            </Button>

            <form action={action}>
              <input type="hidden" name="project_id" value={projectId} />
              <Button type="submit" loading={isPending} loadingText="Voltando…">
                Confirmar retorno
              </Button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  )
}
