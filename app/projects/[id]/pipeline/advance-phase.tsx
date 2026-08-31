'use client'

import { useActionState, useEffect, useRef } from 'react'
import { advancePhase, type AdvancePhaseState } from './actions'
import {
  PHASE_1,
  PHASE_2,
  missingInputsList,
  type PipelineRequirement,
} from './preconditions'
import { PROJECT_PHASES } from '../phase-bar'
import { Button } from '@/app/components/ui/button'
import { Alert } from '@/app/components/ui/alert'
import { ArrowRightIcon } from '@/app/components/ui/icons'

const initialState: AdvancePhaseState = null

const nextPhaseName = PROJECT_PHASES[PHASE_2 - 1].name

const dialogClass =
  'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface ' +
  'p-0 text-ink backdrop:bg-black/40'

export function AdvancePhase({
  projectId,
  phase,
  pending,
}: {
  projectId: string
  phase: number
  pending: PipelineRequirement[]
}) {
  const [state, action, isPending] = useActionState(advancePhase, initialState)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (state) dialog.current?.close()
  }, [state])

  const advanced = state !== null && 'ok' in state
  const error = state !== null && 'error' in state ? state.error : null

  if (phase !== PHASE_1) {
    return advanced ? (
      <Alert tone="success" className="mt-4">
        O projeto avançou para a Fase {PHASE_2} — {nextPhaseName}. Esta aba de
        configuração continua acessível.
      </Alert>
    ) : (
      <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
        A Fase 1 já foi concluída: o projeto está na Fase {phase}. Esta aba continua aqui
        para consulta do que foi configurado.
      </p>
    )
  }

  const blocked = pending.length > 0

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
          Avançar para a Fase {PHASE_2}
          <ArrowRightIcon />
        </Button>

        {blocked ? (
          <span className="text-[13px] text-muted">
            {pending.length === 1 ? 'Falta' : 'Faltam'} {missingInputsList(pending)} para
            liberar o avanço.
          </span>
        ) : (
          <span className="text-[13px] text-muted">
            A configuração está completa. O avanço pede confirmação antes de mudar
            qualquer coisa.
          </span>
        )}
      </div>

      <dialog ref={dialog} className={dialogClass} aria-labelledby="avancar-fase-titulo">
        <div className="flex flex-col gap-4 p-5">
          <h3 id="avancar-fase-titulo" className="m-0 text-[15px] font-bold text-ink">
            Avançar para a Fase {PHASE_2} — {nextPhaseName}?
          </h3>

          <div className="flex flex-col gap-2 text-[13px] leading-[1.6] text-muted">
            <p className="m-0">
              Na Fase {PHASE_2}, as definições que você cadastrou recebem descrição e
              viram os critérios do codebook, e o texto do prompt vigente passa a ser
              usado sobre os itens de entrada do projeto para gerar as respostas que os
              avaliadores vão avaliar.
            </p>
            <p className="m-0">
              Nada é congelado agora: as versões do codebook e do prompt continuam
              editáveis até serem usadas numa rodada, e esta aba de configuração continua
              acessível depois do avanço.
            </p>
            <p className="m-0">Cancelar não muda nada.</p>
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
