'use client'

import { useEffect, useId, useRef } from 'react'
import { Button } from './button'
import { cardClassName } from './card'
import { cx } from './cx'

export function EditableRow({
  title,
  meta,
  badges,
  actions,
  expanded,
  onToggle,
  expandLabel = 'Editar',
  collapseLabel = 'Concluir edição',
  footer,
  className,
  children,
}: {
  title: React.ReactNode
  meta?: React.ReactNode
  badges?: React.ReactNode
  actions?: React.ReactNode
  expanded: boolean
  onToggle: () => void
  expandLabel?: React.ReactNode
  collapseLabel?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const panelId = useId()
  const expandRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)

  useEffect(() => {
    if (expanded || !restoreFocus.current) return
    restoreFocus.current = false
    expandRef.current?.focus()
  }, [expanded])

  function collapse() {
    restoreFocus.current = true
    onToggle()
  }

  return (
    <div
      className={cardClassName({
        padding: 'sm',
        tone: expanded ? 'accent' : 'default',
        className,
      })}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="flex min-w-[160px] flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-sm font-semibold text-ink">{title}</span>
          {meta ? <span className="text-[13px] text-muted">{meta}</span> : null}
        </span>

        <span className="flex flex-wrap items-center gap-2">
          {badges}
          {expanded ? null : (
            <Button
              ref={expandRef}
              variant="secondary"
              size="sm"
              aria-expanded={false}
              aria-controls={panelId}
              onClick={onToggle}
            >
              {expandLabel}
            </Button>
          )}
          {actions}
        </span>
      </div>

      <div
        id={panelId}
        className={cx('mt-3 flex-col gap-3', expanded ? 'flex' : 'hidden')}
      >
        {children}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
          <span className="text-[13px] text-muted">{footer}</span>
          <Button variant="secondary" size="sm" onClick={collapse}>
            {collapseLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
