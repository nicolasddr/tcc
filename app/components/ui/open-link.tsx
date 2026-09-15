import Link from '@/app/components/app-link'

export function OpenLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className="font-semibold text-brand hover:text-brand-hover">
      {children}
    </Link>
  )
}
