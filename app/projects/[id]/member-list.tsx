import { roleLabel, memberStatusLabel } from '../labels'
import type { ListedMember } from '../members'
import { RemoveMemberButton } from './member-actions'
import { ButtonLink } from '@/app/components/ui/button'
import { StatusBadge } from '@/app/components/ui/badge'
import { Avatar } from '@/app/components/ui/avatar'

export function MemberList({
  projectId,
  members,
  viewerId,
  canManage,
}: {
  projectId: string
  members: ListedMember[]
  viewerId: string
  canManage: boolean
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {members.map((m) => (
        <li
          key={m.userId}
          className="flex items-center gap-2.5 rounded-control px-1 py-1.5"
        >
          <Avatar fallback={m.name.charAt(0)} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-semibold text-ink">{m.name}</span>
            <span className="truncate text-[11px] text-muted">
              {m.roles.map(roleLabel).join(' · ')}
              {m.email !== m.name ? ` · ${m.email}` : ''}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            {m.status !== 'active' ? (
              <StatusBadge status={m.status}>{memberStatusLabel(m.status)}</StatusBadge>
            ) : null}
            {/* HU-029: só o admin, e só para quem é avaliador. */}
            {canManage && m.roles.includes('evaluator') ? (
              <ButtonLink
                href={`/projects/${projectId}/responses/${m.userId}`}
                variant="link"
              >
                Ver respostas
              </ButtonLink>
            ) : null}
            {/* HU-021: o admin remove um avaliador ativo (não a si mesmo,
                nem outro administrador). */}
            {canManage &&
            m.roles.includes('evaluator') &&
            !m.roles.includes('administrator') &&
            m.status === 'active' &&
            m.userId !== viewerId ? (
              <RemoveMemberButton
                projectId={projectId}
                memberUserId={m.userId}
                memberName={m.name}
              />
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}
