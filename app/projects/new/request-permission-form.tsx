'use client'

import { useActionState } from 'react'
import {
  requestCreatePermission,
  type RequestPermissionState,
} from '@/app/projects/actions'
import { Button } from '@/app/components/ui/button'
import { Form, FormActions } from '@/app/components/ui/form'
import { Alert } from '@/app/components/ui/alert'

const initialState: RequestPermissionState = null

export function RequestPermissionForm() {
  const [state, action, pending] = useActionState(requestCreatePermission, initialState)

  return (
    <Form action={action}>
      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? <Alert tone="success">{state.ok}</Alert> : null}

      <FormActions align="start">
        <Button type="submit" loading={pending} loadingText="Enviando…">
          Solicitar permissão
        </Button>
      </FormActions>
    </Form>
  )
}
