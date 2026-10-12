import { LearnMore } from '@/app/components/ui/learn-more'

export const HOW_TO_READ_TABLE = 'Como ler esta tabela'

export function HowToRead({
  paragraphs,
  summary = HOW_TO_READ_TABLE,
}: {
  paragraphs: readonly string[]
  summary?: string
}) {
  return <LearnMore summary={summary} points={paragraphs} />
}
