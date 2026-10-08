import { guidanceShortcut, type ReadingGuidance } from './reading-guidance'
import { GUIDANCE_HEADING, guidanceText, shortcutLabel } from './reading-guidance-labels'
import { Card } from '@/app/components/ui/card'
import { OpenLink } from '@/app/components/ui/open-link'

export function ReadingGuidanceNote({
  guidance,
  projectId,
}: {
  guidance: ReadingGuidance
  projectId: string
}) {
  const shortcut = guidanceShortcut(guidance, projectId)
  return (
    <Card tone="subtle" padding="sm" className="mt-8">
      <p className="m-0 text-[13px] font-semibold text-ink">{GUIDANCE_HEADING}</p>
      <p className="m-0 mt-1.5 text-[13px] text-ink">{guidanceText(guidance)}</p>
      {shortcut ? (
        <p className="m-0 mt-2 text-[13px]">
          <OpenLink href={shortcut.href}>{shortcutLabel(shortcut.kind)}</OpenLink>
        </p>
      ) : null}
    </Card>
  )
}
