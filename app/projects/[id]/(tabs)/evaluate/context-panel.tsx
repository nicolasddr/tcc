import type { EvaluationContext } from './context'
import { Card } from '@/app/components/ui/card'
import { preWrapClass, scrollBoxClass } from '@/app/components/ui/prose'

const textClass = `m-0 text-[13px] leading-[1.6] ${scrollBoxClass} ${preWrapClass} text-ink`

export function ContextCard({
  label,
  description,
  text,
}: {
  label: string
  description?: string | null
  text: string
}) {
  return (
    <Card tone="subtle" padding="sm" className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-label">{label}</span>
        {description ? (
          <p className={`m-0 text-xs text-muted ${preWrapClass}`}>{description}</p>
        ) : null}
      </div>
      <p className={textClass}>{text}</p>
    </Card>
  )
}

export function ItemPanel({ item }: { item: EvaluationContext['item'] }) {
  return <ContextCard label={`Item de entrada · ${item.name}`} text={item.content} />
}

export function PromptPanel({ prompt }: { prompt: EvaluationContext['prompt'] }) {
  return (
    <ContextCard
      label={`Prompt · ${prompt.name ?? `versão ${prompt.versionNumber}`}`}
      description={prompt.description}
      text={prompt.text}
    />
  )
}
