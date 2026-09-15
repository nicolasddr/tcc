import type { EvaluationContext } from './context'
import { Card } from '@/app/components/ui/card'
import { Disclosure } from '@/app/components/ui/disclosure'
import { preWrapClass, scrollBoxClass } from '@/app/components/ui/prose'

const textClass = `m-0 text-[13px] leading-[1.6] ${scrollBoxClass} ${preWrapClass} text-ink`

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] font-semibold text-label">{label}</span>
      {children}
    </div>
  )
}

export function ContextPanel({ context }: { context: EvaluationContext }) {
  const { prompt, item } = context

  return (
    <Card tone="subtle" padding="sm">
      <Disclosure summary="O que foi pedido à LLM">
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          {prompt.name ? (
            <Block label="Nome do prompt">
              <p className={`m-0 text-[13px] ${preWrapClass} text-ink`}>{prompt.name}</p>
            </Block>
          ) : null}

          {prompt.description ? (
            <Block label="Descrição do prompt">
              <p className={`m-0 text-[13px] ${preWrapClass} text-ink`}>
                {prompt.description}
              </p>
            </Block>
          ) : null}

          <Block label={`Prompt · versão ${prompt.versionNumber}`}>
            <p className={textClass}>{prompt.text}</p>
          </Block>

          <Block label={`Item de entrada · ${item.name}`}>
            <p className={textClass}>{item.content}</p>
          </Block>
        </div>
      </Disclosure>
    </Card>
  )
}
