import { ButtonLink, buttonClass } from '@/app/components/ui/button'

function NavLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={buttonClass('secondary', {
          size: 'sm',
          className: 'pointer-events-none opacity-50',
        })}
      >
        {children}
      </span>
    )
  }

  return (
    <ButtonLink variant="secondary" size="sm" href={href}>
      {children}
    </ButtonLink>
  )
}

export function QueueNav({ prev, next }: { prev: string | null; next: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <NavLink href={prev}>Resposta anterior</NavLink>
      <NavLink href={next}>Próxima resposta</NavLink>
    </div>
  )
}
