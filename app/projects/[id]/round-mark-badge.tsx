import type { RoundMark } from './round-usage'
import { Badge } from '@/app/components/ui/badge'
import { InfoTooltip } from '@/app/components/ui/tooltip'

export function RoundMarkBadge({ mark }: { mark: RoundMark }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone="neutral">{mark.short}</Badge>
      <InfoTooltip text={mark.full} />
    </span>
  )
}
