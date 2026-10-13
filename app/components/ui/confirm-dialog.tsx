'use client'

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from './button'

export const dialogClass =
  'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface ' +
  'p-0 text-ink backdrop:bg-black/40'

export type ConfirmTone = 'default' | 'danger'

export function DialogLines({ lines }: { lines: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2 text-[13px] leading-[1.6] text-muted">
      {lines.map((line) => (
        <p key={line} className="m-0">
          {line}
        </p>
      ))}
    </div>
  )
}

function ConfirmActions({
  cancelRef,
  confirmLabel,
  pendingLabel,
  tone,
  onCancel,
  onDone,
}: {
  cancelRef: RefObject<HTMLButtonElement | null>
  confirmLabel: React.ReactNode
  pendingLabel?: React.ReactNode
  tone: ConfirmTone
  onCancel: () => void
  onDone: () => void
}) {
  const { pending } = useFormStatus()
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !pending) onDone()
    wasPending.current = pending
  }, [pending, onDone])

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={pending}>
        Cancelar
      </Button>

      <Button
        type="submit"
        variant={tone === 'danger' ? 'dangerSolid' : 'primary'}
        loading={pending}
        loadingText={pendingLabel}
      >
        {confirmLabel}
      </Button>
    </div>
  )
}

export function ConfirmDialog({
  trigger,
  title,
  children,
  confirmLabel,
  pendingLabel,
  tone = 'default',
  action,
  fields = {},
}: {
  trigger: (open: () => void) => React.ReactNode
  title: React.ReactNode
  children?: React.ReactNode
  confirmLabel: React.ReactNode
  pendingLabel?: React.ReactNode
  tone?: ConfirmTone
  action: (formData: FormData) => void | Promise<void>
  fields?: Record<string, string>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (opened && !element.open) {
      element.showModal()
      cancel.current?.focus()
    } else if (!opened && element.open) {
      element.close()
    }
  }, [opened])

  function open() {
    setOpened(true)
  }

  function close() {
    setOpened(false)
  }

  return (
    <>
      {trigger(open)}

      <dialog
        ref={dialog}
        className={dialogClass}
        aria-labelledby={titleId}
        onClose={close}
      >
        <form action={action} className="flex flex-col gap-4 p-5">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <h3 id={titleId} className="m-0 text-[15px] font-bold text-ink">
            {title}
          </h3>

          {children}

          <ConfirmActions
            cancelRef={cancel}
            confirmLabel={confirmLabel}
            pendingLabel={pendingLabel}
            tone={tone}
            onCancel={close}
            onDone={close}
          />
        </form>
      </dialog>
    </>
  )
}
