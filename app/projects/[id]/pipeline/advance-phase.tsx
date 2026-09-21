'use client'

import { useActionState, useEffect, useRef } from 'react'
import { advancePhase, type AdvancePhaseState } from './actions'
import { PROJECT_PHASES } from '../phase-bar'
import { Button } from '@/app/components/ui/button'
import { Alert } from '@/app/components/ui/alert'
import { ArrowRightIcon } from '@/app/components/ui/icons'

const initialState: AdvancePhaseState = null

const dialogClass =
  'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface ' +
  'p-0 text-ink backdrop:bg-black/40'

export function AdvancePhase({
  projectId,
  target,
  blocked,
  hint,
  lines,
  summary,
}: {
  projectId: string
  target: number
  blocked: boolean
  hint: string
  lines: readonly string[]
  summary?: React.ReactNode
}) {
  const [state, action, isPending] = useActionState(advancePhase, initialState)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (state) dialog.current?.close()
  }, [state])

  const error = state !== null && 'error' in state ? state.error : null
  const targetName = PROJECT_PHASES[target - 1]?.name
  const titleId = `avancar-fase-${target}-titulo`

  if (state !== null && 'ok' in state) {
    return (
      <Alert tone="success" className="mt-4">
        O projeto avançou para a Fase {target} — {targetName}. O que ficou para trás
        continua acessível para consulta.
      </Alert>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          onClick={() => dialog.current?.showModal()}
          disabled={blocked}
          loading={isPending}
          loadingText="Avançando…"
        >
          Avançar para a Fase {target}
          <ArrowRightIcon />
        </Button>

        <span className="text-[13px] text-muted">{hint}</span>
      </div>

      <dialog ref={dialog} className={dialogClass} aria-labelledby={titleId}>
        <div className="flex flex-col gap-4 p-5">
          <h3 id={titleId} className="m-0 text-[15px] font-bold text-ink">
            Avançar para a Fase {target} — {targetName}?
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
              <Button type="submit" loading={isPending} loadingText="Avançando…">
                Confirmar avanço
              </Button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  )
}
