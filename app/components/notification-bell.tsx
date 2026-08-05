'use client'

import { useState } from 'react'
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '@/app/notifications/actions'
import { SubmitButton } from './submit-button'
import { IconButton } from './ui/button'
import { cx } from './ui/cx'

// Itens já formatados no servidor (texto + data como string) para o sino só
// cuidar da interação (abrir/fechar) e disparar as ações de marcar como lida.
export type InboxItem = {
  id: string
  text: string
  dateLabel: string
  read: boolean
}

export function NotificationBell({ items }: { items: InboxItem[] }) {
  const [open, setOpen] = useState(false)
  const unread = items.filter((n) => !n.read).length

  return (
    <div className="relative">
      <IconButton
        aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute top-0.5 right-0.5 h-4 min-w-4 rounded-full bg-danger-fg-strong px-1 text-center text-[10px] leading-4 font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </IconButton>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default border-0 bg-transparent"
            aria-label="Fechar notificações"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute top-[calc(100%+8px)] right-0 z-50 w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-card border border-line bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-label="Notificações"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line-soft px-3.5 py-3">
              <span className="text-sm font-bold text-ink">Notificações</span>
              {unread > 0 ? (
                <form action={markAllNotificationsRead}>
                  <SubmitButton variant="link" pendingText="Marcando…">
                    Marcar todas como lidas
                  </SubmitButton>
                </form>
              ) : null}
            </div>

            {items.length === 0 ? (
              <p className="m-0 px-3.5 py-6 text-center text-[13px] text-muted">
                Você não tem notificações.
              </p>
            ) : (
              <ul className="m-0 max-h-[380px] list-none overflow-y-auto p-0">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={cx(
                      'flex flex-col gap-1.5 border-b border-line-soft px-3.5 py-3 last:border-b-0',
                      !n.read && 'bg-brand-tint',
                    )}
                  >
                    <span className="text-[13px] leading-[1.45] text-ink-soft">
                      {n.text}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-faint">{n.dateLabel}</span>
                      {!n.read ? (
                        <form action={markNotificationRead}>
                          <input type="hidden" name="notification_id" value={n.id} />
                          <SubmitButton variant="link" pendingText="Marcando…">
                            Marcar como lida
                          </SubmitButton>
                        </form>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
