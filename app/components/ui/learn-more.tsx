import { Card } from './card'
import { Disclosure } from './disclosure'

export function LearnMore({
  summary = 'Saiba mais',
  points,
  className,
}: {
  summary?: string
  points: readonly string[]
  className?: string
}) {
  return (
    <Disclosure summary={summary} className={className}>
      <Card tone="subtle" padding="sm" className="mt-2">
        <ul className="m-0 flex list-disc flex-col gap-2 pl-[18px] text-[13px] text-muted">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </Card>
    </Disclosure>
  )
}
