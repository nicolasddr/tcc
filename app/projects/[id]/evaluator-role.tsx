'use client'

import { useActionState } from 'react'
import {
  assumeEvaluatorRole,
  revokeEvaluatorRole,
  type EvaluatorRoleState,
} from '@/app/projects/actions'
import {
  canRevokeEvaluatorRole,
  REVOKE_EVALUATIONS_SUBMITTED,
  type EvaluatorRoleView,
} from '@/app/projects/evaluator-link'
import { Button, ButtonLink } from '@/app/components/ui/button'
import { Alert } from '@/app/components/ui/alert'

const initialState: EvaluatorRoleState = null

const statusText: Record<string, string> = {
  pending_onboarding:
    'Você assumiu o papel de avaliador, mas o vínculo só fica ativo depois do consentimento e do questionário de perfil.',
  active: 'Você participa deste projeto como Administrador-avaliador.',
  inactive: 'Seu vínculo de avaliador neste projeto está inativo.',
}

export function EvaluatorRolePanel({
  projectId,
  view,
}: {
  projectId: string
  view: EvaluatorRoleView
}) {
  const [assumeState, assume, assuming] = useActionState(assumeEvaluatorRole, initialState)
  const [revokeState, revoke, revoking] = useActionState(revokeEvaluatorRole, initialState)

  const state = assumeState ?? revokeState
  const link = view.link

  return (
    <div className="flex flex-col gap-3">
      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? <Alert tone="success">{state.ok}</Alert> : null}

      {link ? (
        <>
          <p className="m-0 text-[13px] text-muted">{statusText[link.status]}</p>

          <div className="flex flex-wrap items-center gap-3">
            {link.status === 'pending_onboarding' ? (
              <ButtonLink href={`/projects/${projectId}/onboarding`}>
                Concluir onboarding
              </ButtonLink>
            ) : null}

            {canRevokeEvaluatorRole(view) ? (
              <form
                action={revoke}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      'Desfazer o papel de avaliador? Você deixa de participar como avaliador e o consentimento e as respostas de perfil desse vínculo são apagados. Seu acesso de administrador não muda.',
                    )
                  )
                    e.preventDefault()
                }}
              >
                <input type="hidden" name="project_id" value={projectId} />
                <Button
                  type="submit"
                  variant="danger"
                  loading={revoking}
                  loadingText="Desfazendo…"
                >
                  Desfazer papel de avaliador
                </Button>
              </form>
            ) : (
              <p className="m-0 text-[13px] text-muted">{REVOKE_EVALUATIONS_SUBMITTED}</p>
            )}
          </div>
        </>
      ) : (
        <form action={assume} className="flex flex-col gap-3">
          <input type="hidden" name="project_id" value={projectId} />
          <div>
            <Button type="submit" loading={assuming} loadingText="Assumindo…">
              Assumir o papel de avaliador
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
