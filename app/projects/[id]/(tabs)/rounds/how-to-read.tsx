import { Card } from '@/app/components/ui/card'
import { Disclosure } from '@/app/components/ui/disclosure'

export const HOW_TO_READ_TABLE = 'Como ler esta tabela'

export function HowToRead({
  paragraphs,
  summary = HOW_TO_READ_TABLE,
}: {
  paragraphs: readonly string[]
  summary?: string
}) {
  return (
    <Disclosure summary={summary}>
      <Card tone="subtle" padding="sm" className="mt-2">
        <div className="flex flex-col gap-2 text-[13px] text-muted">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="m-0">
              {paragraph}
            </p>
          ))}
        </div>
      </Card>
    </Disclosure>
  )
}
