'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from './app-link'
import { profileHref } from '@/app/profile/return-to'

export function ProfileLink({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ''
  const search = useSearchParams()?.toString() ?? ''

  return (
    <Link href={profileHref(pathname, search)} title={title} className={className}>
      {children}
    </Link>
  )
}
