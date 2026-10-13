'use client'

import { useId, useLayoutEffect, useRef } from 'react'
import { Button } from './button'
import { cardClassName, cardInteractiveClass } from './card'
import { cx } from './cx'

const INTERACTIVE = 'button, a, input, select, textarea, summary, label, details'

export function EditableRow({
  title,
  meta,
  preview,
  badges,
  actions,
  expanded,
  onToggle,
  expandLabel = 'Editar',
  collapseLabel,
  footer,
  className,
  children,
}: {
  title: React.ReactNode
  meta?: React.ReactNode
  preview?: React.ReactNode
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
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(false)

  useLayoutEffect(() => {
    if (expanded) return
    const focusInside = panelRef.current?.contains(document.activeElement) ?? false
    if (!restoreFocus.current && !focusInside) return
    restoreFocus.current = false
    expandRef.current?.focus()
  }, [expanded])

  function collapse() {
    restoreFocus.current = true
    onToggle()
  }

  const toggleLabel = expanded ? collapseLabel : expandLabel

  function onCardClick(event: React.MouseEvent<HTMLDivElement>) {
    if (expanded) return
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return
    onToggle()
  }

  return (
    <div
      onClick={onCardClick}
      className={cardClassName({
        padding: 'sm',
        tone: expanded ? 'accent' : 'default',
        className: cx(expanded ? null : `cursor-pointer ${cardInteractiveClass}`, className),
      })}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="flex min-w-[160px] flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-sm font-semibold text-ink">{title}</span>
          {meta ? <span className="text-[13px] text-muted">{meta}</span> : null}
        </span>

        <span className="flex flex-wrap items-center gap-2">
          {badges}
          {toggleLabel ? (
            <Button
              ref={expandRef}
              variant="secondary"
              size="sm"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={expanded ? collapse : onToggle}
            >
              {toggleLabel}
            </Button>
          ) : null}
          {actions}
        </span>
      </div>

      {preview && !expanded ? <div className="mt-1.5">{preview}</div> : null}

      <div
        id={panelId}
        ref={panelRef}
        className={cx('mt-3 flex-col gap-3', expanded ? 'flex' : 'hidden')}
      >
        {children}

        {footer ? (
          <p className="m-0 border-t border-line pt-3 text-[13px] text-muted">{footer}</p>
        ) : null}
      </div>
    </div>
  )
}
