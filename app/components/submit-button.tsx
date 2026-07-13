'use client'

import { useFormStatus } from 'react-dom'
import { buttonClass, type ButtonSize, type ButtonVariant } from './ui/button'

// Botão de submit para `<form action={serverAction}>` que dá feedback enquanto a ação roda.
// Sem isso o botão fica idêntico durante o round-trip + revalidation e o usuário acha que
// travou (e reclica). useFormStatus só funciona num componente FILHO do form — por isso o
// botão é seu próprio componente, e não o próprio `<form>`.
//
// Estilo: passando `variant` ele veste a primitiva Button (buttonClass); sem `variant` o
// `className` cru é usado como está — é o que os componentes ainda não migrados (o sino, o
// logout) precisam. Assim este wrapper cuida só do estado pendente e delega a aparência.
//
// `pendingText` (opcional) troca o rótulo durante o envio; o botão sempre desabilita e marca
// aria-busy. Forms que já usam o `pending` do useActionState usam a primitiva Button direto.
export function SubmitButton({
  children,
  pendingText,
  variant,
  size,
  fullWidth,
  className,
  ...rest
}: {
  children: React.ReactNode
  pendingText?: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className={variant ? buttonClass(variant, { size, fullWidth, className }) : className}
      disabled={pending}
      aria-busy={pending}
      {...rest}
    >
      {pending && pendingText != null ? pendingText : children}
    </button>
  )
}
