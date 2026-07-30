'use client'

import { useActionState } from 'react'
import {
  requestCreatePermission,
  type RequestPermissionState,
} from '@/app/projects/actions'
import { Button } from '@/app/components/ui/button'
import { Alert } from '@/app/components/ui/alert'

const initialState: RequestPermissionState = null

export function RequestPermissionForm({ alreadyPending }: { alreadyPending: boolean }) {
  const [state, action, pending] = useActionState(requestCreatePermission, initialState)

  if (alreadyPending) {
    return (
      <Alert tone="notice">
        Sua solicitação para criar projetos está em análise. Você receberá uma notificação
        assim que ela for aprovada ou recusada.
      </Alert>
    )
  }

  return (
    <form action={action} className="project-form">
      <p className="project-page-subtitle">
        Sua conta ainda não tem permissão para criar projetos. Solicite o acesso e um
        administrador da plataforma vai analisar o pedido.
      </p>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? <Alert tone="success">{state.ok}</Alert> : null}

      <div className="form-actions">
        <Button type="submit" loading={pending} loadingText="Enviando…">
          Solicitar permissão
        </Button>
      </div>
    </form>
  )
}
