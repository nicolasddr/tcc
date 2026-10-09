import { cx } from './cx'
import { InfoTooltip } from './tooltip'

// Bloco de seção: filete no topo + título + dica opcional, usado nas telas de projeto.
// O conteúdo entra 16px abaixo do cabeçalho, então os filhos não precisam carregar
// margem própria.

export function Section({
  title,
  hint,
  help,
  action,
  id,
  divider = true,
  className,
  children,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  help?: string
  action?: React.ReactNode
  id?: string
  divider?: boolean
  className?: string
  children: React.ReactNode
}) {
  const heading = (
    <h2 className="flex flex-wrap items-center gap-2 text-[16px] font-bold text-ink">
      {title}
      {help ? <InfoTooltip text={help} /> : null}
    </h2>
  )

  return (
    <section
      id={id}
      className={cx(
        divider ? 'mt-8 border-t border-line pt-6' : 'mt-6',
        className,
      )}
    >
      {action ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      {hint ? <p className="mt-1.5 text-[13px] text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}
