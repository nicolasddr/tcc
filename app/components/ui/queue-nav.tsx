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

export function QueueNav({
  prev,
  next,
  position,
}: {
  prev: string | null
  next: string | null
  position?: { current: number; total: number }
}) {
  return (
    <nav aria-label="Navegação entre respostas" className="flex flex-wrap items-center gap-2">
      <NavLink href={prev}>Resposta anterior</NavLink>
      {position ? (
        <span
          aria-live="polite"
          className="min-w-[4.5rem] text-center text-[13px] font-semibold whitespace-nowrap text-ink tabular-nums"
        >
          {`${position.current} de ${position.total}`}
        </span>
      ) : null}
      <NavLink href={next}>Próxima resposta</NavLink>
    </nav>
  )
}
