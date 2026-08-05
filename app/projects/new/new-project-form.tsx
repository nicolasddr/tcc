'use client'

import { useActionState } from 'react'
import { createProject, type CreateProjectState } from '@/app/projects/actions'
import { TASK_TYPE_OPTIONS } from '@/app/projects/task-types'
import { Button, ButtonLink } from '@/app/components/ui/button'
import { Field, Input, Textarea, Select } from '@/app/components/ui/field'
import { Form, FormActions } from '@/app/components/ui/form'
import { Alert } from '@/app/components/ui/alert'

const initialState: CreateProjectState = null

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProject, initialState)

  return (
    <Form action={action}>
      <Field label="Nome" required>
        <Input
          type="text"
          name="name"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Ex.: Classificação de intenção de busca"
        />
      </Field>

      <Field label="Descrição">
        <Textarea
          name="description"
          rows={4}
          maxLength={2000}
          placeholder="Opcional — o objetivo do projeto, o contexto da tarefa…"
        />
      </Field>

      <Field
        label="Tipo de tarefa"
        hint="Opcional. Apenas para personalização de dicas durante o processo."
      >
        <Select name="task_type" defaultValue="">
          <option value="">Não declarar agora</option>
          {TASK_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <FormActions>
        <ButtonLink href="/dashboard" variant="secondary">
          Cancelar
        </ButtonLink>
        <Button type="submit" loading={pending} loadingText="Criando…">
          Criar projeto
        </Button>
      </FormActions>
    </Form>
  )
}
