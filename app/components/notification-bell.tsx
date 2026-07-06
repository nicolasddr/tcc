'use client'

import { useState } from 'react'
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '@/app/notifications/actions'
import { SubmitButton } from './submit-button'

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
    <div className="bell">
      <button
        type="button"
        className="bell-button"
        aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
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
        {unread > 0 ? <span className="bell-badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="bell-backdrop"
            aria-label="Fechar notificações"
            onClick={() => setOpen(false)}
          />
          <div className="bell-panel" role="dialog" aria-label="Notificações">
            <div className="bell-panel-head">
              <span className="bell-panel-title">Notificações</span>
              {unread > 0 ? (
                <form action={markAllNotificationsRead}>
                  <SubmitButton className="bell-mark-all" pendingText="Marcando…">
                    Marcar todas como lidas
                  </SubmitButton>
                </form>
              ) : null}
            </div>

            {items.length === 0 ? (
              <p className="bell-empty">Você não tem notificações.</p>
            ) : (
              <ul className="bell-list">
                {items.map((n) => (
                  <li key={n.id} className={`bell-item${n.read ? '' : ' bell-item-unread'}`}>
                    <span className="bell-item-text">{n.text}</span>
                    <span className="bell-item-meta">
                      <span className="bell-item-date">{n.dateLabel}</span>
                      {!n.read ? (
                        <form action={markNotificationRead}>
                          <input type="hidden" name="notification_id" value={n.id} />
                          <SubmitButton className="bell-mark-one" pendingText="Marcando…">
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
