'use client'

import Link, { useLinkStatus } from 'next/link'
import type { ComponentProps } from 'react'
import './nav-progress.css'

// Barra de progresso fixa no topo. Precisa ser descendente de <Link> para poder
// ler useLinkStatus(). O CSS só a torna visível depois de ~250ms de pending, então
// navegações rápidas (o comum aqui, ~47ms) nunca a mostram — ela só aparece quando
// a navegação realmente demora (ex.: o refresh de auth ocasional).
function NavProgress() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <span aria-hidden className="nav-progress" />
}

// Drop-in do next/link usado em toda a app: mesma API do <Link>, mas com feedback
// embutido para navegações lentas. Só as navegações client-side por <Link> disparam
// a barra; submits de server action já têm feedback de pending nos próprios botões.
export default function AppLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <NavProgress />
    </Link>
  )
}
