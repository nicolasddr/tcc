'use client'

import { useActionState } from 'react'
import Link from '@/app/components/app-link'
import { updateProfile, type UpdateProfileState } from './actions'
import { Button, buttonClass } from '@/app/components/ui/button'
import { Field, Input } from '@/app/components/ui/field'
import { Alert } from '@/app/components/ui/alert'

const initialState: UpdateProfileState = null

export function ProfileForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState(updateProfile, initialState)

  return (
    <form action={action} className="project-form">
      <Field label="Nome" required>
        <Input
          type="text"
          name="name"
          required
          maxLength={200}
          autoComplete="name"
          defaultValue={initialName}
        />
      </Field>

      {state && 'error' in state ? <Alert tone="error">{state.error}</Alert> : null}
      {state && 'ok' in state ? <Alert tone="success">{state.ok}</Alert> : null}

      <div className="form-actions">
        <Link href="/dashboard" className={buttonClass('secondary')}>
          Voltar
        </Link>
        <Button type="submit" loading={pending} loadingText="Salvando…">
          Salvar
        </Button>
      </div>
    </form>
  )
}
