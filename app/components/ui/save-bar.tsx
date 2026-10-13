import { Button } from './button'
import { cx } from './cx'

export function SaveBar({
  dirty,
  changes,
  onDiscard,
  saveLabel = 'Salvar',
  loading,
  loadingText,
  className,
  children,
}: {
  dirty: boolean
  changes: React.ReactNode
  onDiscard: () => void
  saveLabel?: React.ReactNode
  loading?: boolean
  loadingText?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cx(
        'sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-3',
        'rounded-card border border-line-strong bg-surface px-4 py-3',
        'shadow-[0_-2px_10px_rgba(0,0,0,0.06)]',
        className,
      )}
    >
      <span className="text-[13px] text-muted" role="status">
        {dirty ? changes : 'Nenhuma alteração.'}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        <Button variant="secondary" onClick={onDiscard} disabled={loading}>
          {dirty ? 'Descartar' : 'Cancelar'}
        </Button>
        <Button type="submit" disabled={!dirty} loading={loading} loadingText={loadingText}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
