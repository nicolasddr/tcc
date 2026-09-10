'use client'

import { useRef } from 'react'
import { cx } from './cx'
import { Disclosure } from './disclosure'
import { IconButton, iconButtonClass } from './button'
import { ChevronDownIcon, ChevronUpIcon, MoreHorizontalIcon } from './icons'

export type RowMove = {
  label: string
  disabled?: boolean
  onClick: () => void
}

export function RowMenuItem({
  className,
  children,
  type = 'button',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx(
        'flex w-full cursor-pointer items-center gap-2 rounded-control border-0',
        'bg-transparent px-2.5 py-1.5 text-left text-[13px] font-semibold',
        'text-danger-fg transition-colors not-disabled:hover:bg-danger-tint',
        'disabled:cursor-default disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ring',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function RowActions({
  up,
  down,
  menuLabel = 'Mais ações',
  className,
  children,
}: {
  up?: RowMove
  down?: RowMove
  menuLabel?: string
  className?: string
  children?: React.ReactNode
}) {
  const menuRef = useRef<HTMLDetailsElement>(null)

  function close() {
    const menu = menuRef.current
    if (!menu) return
    menu.open = false
  }

  return (
    <div className={cx('flex items-center gap-0.5', className)}>
      {up ? (
        <IconButton
          size="sm"
          aria-label={up.label}
          disabled={up.disabled}
          onClick={up.onClick}
        >
          <ChevronUpIcon />
        </IconButton>
      ) : null}

      {down ? (
        <IconButton
          size="sm"
          aria-label={down.label}
          disabled={down.disabled}
          onClick={down.onClick}
        >
          <ChevronDownIcon />
        </IconButton>
      ) : null}

      {children ? (
        <Disclosure
          ref={menuRef}
          className="relative"
          chevron={false}
          summaryClassName={iconButtonClass('sm', 'group-open:bg-canvas')}
          summary={
            <>
              <MoreHorizontalIcon />
              <span className="sr-only">{menuLabel}</span>
            </>
          }
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            close()
            menuRef.current?.querySelector('summary')?.focus()
          }}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) return
            close()
          }}
        >
          <div
            className={cx(
              'absolute top-full right-0 z-20 mt-1 flex min-w-[176px] flex-col gap-0.5',
              'rounded-card border border-line-strong bg-surface p-1',
              'shadow-[0_4px_12px_rgba(0,0,0,0.08)]',
            )}
          >
            {children}
          </div>
        </Disclosure>
      ) : null}
    </div>
  )
}
