import type { ResponseForAdmin } from '../../pipeline/responses'
import { Card } from '@/app/components/ui/card'
import { Disclosure } from '@/app/components/ui/disclosure'
import { preWrapClass, scrollBoxClass } from '@/app/components/ui/prose'

export const SENT_INPUT_SUMMARY = 'Entrada enviada à LLM'

export const SENT_INPUT_MISSING =
  'Esta resposta foi gerada antes de a ferramenta gravar a entrada enviada.'

export function SentInput({ sentInput }: { sentInput: string | null }) {
  if (sentInput === null) {
    return <p className="m-0 text-[13px] text-muted">{SENT_INPUT_MISSING}</p>
  }

  return (
    <Disclosure summary={SENT_INPUT_SUMMARY}>
      <pre
        className={`m-0 mt-2 font-mono text-[12.5px] leading-[1.6] ${scrollBoxClass} ${preWrapClass} text-ink`}
      >
        {sentInput}
      </pre>
    </Disclosure>
  )
}

export function AdminResponseCard({ response }: { response: ResponseForAdmin }) {
  return (
    <Card tone="subtle" padding="sm">
      <p className={`m-0 text-sm ${scrollBoxClass} ${preWrapClass} text-ink`}>
        {response.text}
      </p>
      <div className="mt-3 border-t border-line pt-3">
        <SentInput sentInput={response.sentInput} />
      </div>
    </Card>
  )
}
