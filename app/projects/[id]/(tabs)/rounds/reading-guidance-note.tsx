import type { ReadingGuidance } from './reading-guidance'
import { GUIDANCE_HEADING, guidanceText } from './reading-guidance-labels'
import { Card } from '@/app/components/ui/card'

export function ReadingGuidanceNote({ guidance }: { guidance: ReadingGuidance }) {
  return (
    <Card tone="subtle" padding="sm" className="mt-6">
      <p className="m-0 text-[13px] font-semibold text-ink">{GUIDANCE_HEADING}</p>
      <p className="m-0 mt-1.5 text-[13px] text-ink">{guidanceText(guidance)}</p>
    </Card>
  )
}
