'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cx } from './cx'

export function InfoTooltip({ text, label }: { text: string; label?: string }) {
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const visible = open || hovered

  useEffect(() => {
    if (!visible) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      setHovered(false)
    }

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [visible])

  return (
    <span
      ref={rootRef}
      className="relative -m-[3px] inline-flex align-middle"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setHovered(false)
      }}
    >
      <button
        type="button"
        aria-label={label ?? 'Mais informações'}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => {
          if (open) setHovered(false)
          setOpen(!open)
        }}
        className="group/info inline-flex h-6 w-6 cursor-help items-center justify-center rounded-full focus-visible:ring-[3px] focus-visible:ring-brand-ring focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className={cx(
            'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-surface text-[11px] font-bold transition-colors group-hover/info:border-muted group-hover/info:text-ink',
            open ? 'border-muted text-ink' : 'border-line-strong text-muted',
          )}
        >
          i
        </span>
      </button>

      <span
        id={id}
        role="tooltip"
        className={cx(
          'absolute top-full left-0 z-50 mt-2 w-[min(320px,calc(100vw-3rem))] before:absolute before:inset-x-0 before:-top-2 before:h-2 rounded-control bg-ink-soft px-3 py-2.5 text-left text-[12.5px] leading-[1.5] font-normal whitespace-pre-wrap text-surface shadow-[0_4px_12px_rgba(0,0,0,0.18)]',
          visible ? 'block' : 'hidden',
        )}
      >
        {text}
      </span>
    </span>
  )
}
