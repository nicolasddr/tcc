import { Fragment } from 'react'
import { QUALITY_SECTION_ID } from './reading-guidance'
import { OpenLink } from '@/app/components/ui/open-link'

export const AGREEMENT_SECTION_ID = 'concordancia'
export const ROUNDS_SECTION_ID = 'rodadas-do-projeto'

export type ReadingShortcut = { href: string; label: string }

export function readingShortcuts({
  agreement,
  quality,
  rounds,
  review,
}: {
  agreement: boolean
  quality: boolean
  rounds?: number
  review?: string
}): ReadingShortcut[] {
  return [
    ...(agreement ? [{ href: `#${AGREEMENT_SECTION_ID}`, label: 'Concordância' }] : []),
    ...(quality ? [{ href: `#${QUALITY_SECTION_ID}`, label: 'Qualidade' }] : []),
    ...(rounds !== undefined
      ? [{ href: `#${ROUNDS_SECTION_ID}`, label: `Rodadas do projeto (${rounds})` }]
      : []),
    ...(review !== undefined ? [{ href: review, label: 'Revisão de discordâncias' }] : []),
  ]
}

export function ReadingShortcuts({ links }: { links: ReadingShortcut[] }) {
  return (
    <nav
      aria-label="Atalhos da leitura"
      className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
    >
      <span className="text-muted">Ir para:</span>
      {links.map((link, index) => (
        <Fragment key={link.href}>
          {index > 0 ? (
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
          ) : null}
          <OpenLink href={link.href}>{link.label}</OpenLink>
        </Fragment>
      ))}
    </nav>
  )
}
