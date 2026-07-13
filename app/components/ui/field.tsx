import { cx } from './cx'

// Campo de formulário: rótulo + controle + (obrigatório / dica / erro). Reproduz o par
// .field/.field-input que se repetia em criar projeto, perfil, convite e perguntas. O
// wrapper é um <label> (como no markup atual), então o clique no rótulo foca o controle
// sem precisar de htmlFor. O controle vem como children — use os <Input>/<Textarea>/<Select>
// abaixo, que já carregam o estilo do antigo .field-input.

// Estilo do controle, compartilhado por input/textarea/select. Isolado para o caso raro de
// um controle precisar da aparência sem o wrapper <Field> (ex.: o input "Outro:" inline).
export const controlClass =
  'w-full rounded-control border border-line-strong bg-surface px-[11px] py-[9px] ' +
  'text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring'

export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode
  required?: boolean
  hint?: React.ReactNode
  error?: React.ReactNode
  /** Classe extra no wrapper (ex.: layout da linha do convite). */
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-semibold text-label">
        {label} {required ? <span className="text-danger-fg-strong">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      {error ? (
        <span className="text-[13px] text-danger-fg" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlClass, className)} {...rest} />
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(controlClass, 'resize-y', className)} {...rest} />
}

export function Select({
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(controlClass, className)} {...rest} />
}
