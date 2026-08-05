import { cx } from './cx'

// Bloco de seção: filete no topo + título + dica opcional, usado nas telas de projeto.
// O conteúdo entra 16px abaixo do cabeçalho, então os filhos não precisam carregar
// margem própria.

export function Section({
  title,
  hint,
  className,
  children,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cx('mt-8 border-t border-line pt-6', className)}>
      <h2 className="text-[16px] font-bold text-ink">{title}</h2>
      {hint ? <p className="mt-1.5 text-[13px] text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}
