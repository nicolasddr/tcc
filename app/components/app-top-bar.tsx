import { Fragment } from 'react'
import Link from '@/app/components/app-link'
import { requireUserId } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'
import { loadTopBar } from './app-top-bar-data'
import { NotificationBell } from './notification-bell'
import { SubmitButton } from './submit-button'
import { Avatar } from './ui/avatar'
import { cx } from './ui/cx'
import { TopBar } from './ui/shell'

export type TrailItem = { label: string; href?: string }

export async function AppTopBar({ trail }: { trail: TrailItem[] }) {
  const userId = await requireUserId()
  const { displayName, email, avatarUrl, initial, inbox } = await loadTopBar(userId)

  return (
    <TopBar>
      <Link
        href="/dashboard"
        aria-label="Engenharia de Prompt"
        className="flex shrink-0 items-center gap-2 text-[15px] font-bold text-brand"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[15px] text-white"
        >
          ✦
        </span>
        <span className="hidden sm:inline">Engenharia de Prompt</span>
      </Link>

      <nav aria-label="Trilha" className="min-w-0 flex-1">
        <ol className="m-0 flex min-w-0 list-none items-center gap-1.5 p-0 text-sm">
          {trail.map((item, i) => {
            const last = i === trail.length - 1
            return (
              <Fragment key={i}>
                {i > 0 ? (
                  <li aria-hidden="true" className="hidden shrink-0 text-faint md:block">
                    /
                  </li>
                ) : null}
                <li
                  className={cx(
                    last ? 'min-w-0' : 'hidden md:block',
                    !last && (i === 0 ? 'shrink-0' : 'min-w-0 shrink-[5]'),
                  )}
                >
                  {last || !item.href ? (
                    <span
                      aria-current={last ? 'page' : undefined}
                      className="block truncate font-semibold text-ink-soft"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="block truncate text-label transition-colors hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              </Fragment>
            )
          })}
        </ol>
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell items={inbox} />
        <Link
          href="/profile"
          title="Editar meu perfil"
          className="flex items-center gap-2.5 rounded-control p-0.5 text-inherit transition-colors hover:bg-canvas"
        >
          <Avatar src={avatarUrl} fallback={initial} />
          <span className="hidden flex-col leading-[1.2] sm:flex">
            <span className="text-sm font-semibold text-ink-soft">{displayName}</span>
            <span className="text-xs text-muted">{email}</span>
          </span>
        </Link>
        <form action={signOut} className="contents">
          <SubmitButton variant="ghost" pendingText="Saindo…">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </SubmitButton>
        </form>
      </div>
    </TopBar>
  )
}
