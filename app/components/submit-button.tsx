'use client'

import { useFormStatus } from 'react-dom'

// Botão de submit para `<form action={serverAction}>` que dá feedback enquanto a ação roda.
// Sem isso o botão fica idêntico durante o round-trip + revalidation e o usuário acha que
// travou (e reclica). useFormStatus só funciona num componente FILHO do form — por isso o
// botão é seu próprio componente, e não o próprio `<form>`.
//
// `pendingText` (opcional) troca o rótulo durante o envio; o botão sempre desabilita e marca
// aria-busy. Forms que já usam o `pending` do useActionState não precisam deste componente.
export function SubmitButton({
  children,
  pendingText,
  className,
  ...rest
}: {
  children: React.ReactNode
  pendingText?: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      {...rest}
    >
      {pending && pendingText != null ? pendingText : children}
    </button>
  )
}
