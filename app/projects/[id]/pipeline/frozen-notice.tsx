import Link from '@/app/components/app-link'
import { Alert } from '@/app/components/ui/alert'
import { LockIcon } from '@/app/components/ui/icons'
import { FROZEN_RETURN_LINK, frozenLead, type FrozenSubject } from './freeze'

export function FrozenNotice({
  subject,
  projectId,
}: {
  subject: FrozenSubject
  projectId: string
}) {
  return (
    <Alert tone="neutral" icon={<LockIcon />}>
      {frozenLead(subject)}{' '}
      <Link
        href={`/projects/${projectId}#voltar`}
        className="font-semibold text-brand transition-colors hover:text-brand-hover"
      >
        {FROZEN_RETURN_LINK}
      </Link>
      .
    </Alert>
  )
}
