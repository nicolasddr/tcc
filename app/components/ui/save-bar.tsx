import { Button } from './button'
import { cx } from './cx'

export function SaveBar({
  changes,
  onDiscard,
  discardLabel = 'Descartar',
  saveLabel = 'Salvar',
  loading,
  loadingText,
  className,
  children,
}: {
  changes: React.ReactNode
  onDiscard: () => void
  discardLabel?: React.ReactNode
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
        {changes}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        <Button variant="secondary" onClick={onDiscard} disabled={loading}>
          {discardLabel}
        </Button>
        <Button type="submit" loading={loading} loadingText={loadingText}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
