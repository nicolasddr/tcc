'use client'

import { useActionState } from 'react'
import { updateProfile, type UpdateProfileState } from './actions'
import { Button, ButtonLink } from '@/app/components/ui/button'
import { Field, Input } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Alert } from '@/app/components/ui/alert'
import { PROFILE_NAME_MAX } from '@/lib/limits'

const initialState: UpdateProfileState = null

export function ProfileForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState(updateProfile, initialState)

  return (
    <Form action={action}>
      <Field label="Nome" required>
        <Input
          type="text"
          name="name"
          required
          maxLength={PROFILE_NAME_MAX}
          autoComplete="name"
          defaultValue={initialName}
        />
      </Field>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? <Alert tone="success">{state.ok}</Alert> : null}

      <FormActions>
        <ButtonLink href="/dashboard" variant="secondary">
          Voltar
        </ButtonLink>
        <Button type="submit" loading={pending} loadingText="Salvando…">
          Salvar
        </Button>
      </FormActions>
    </Form>
  )
}
