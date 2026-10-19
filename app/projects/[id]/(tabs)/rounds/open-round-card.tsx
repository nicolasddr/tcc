import { plural } from '@/lib/plural'
import type { EvaluatorEffort } from './agreement'
import type { RoundSummary } from './rounds'
import type { RoundResponse } from '../../pipeline/responses'
import type { RoundMark } from '../../round-usage'
import { EffortList } from './effort-list'
import { Badge } from '@/app/components/ui/badge'
import { ButtonLink } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { Disclosure } from '@/app/components/ui/disclosure'
import { formatDate } from '@/app/notifications/labels'

export const GENERATE_PANEL_ID = 'gerar'

export function OpenRoundCard({
  round,
  generateHref,
  effort,
  excluded,
  participation,
  generated,
  close,
}: {
  round: RoundSummary
  generateHref: string
  effort: EvaluatorEffort[]
  excluded: ReadonlySet<string>
  participation?: Readonly<Record<string, RoundMark>>
  generated: RoundResponse[]
  close: React.ReactNode
}) {
  return (
    <Card padding="lg" tone="accent" className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0 flex flex-wrap items-center gap-2 text-[16px] font-bold text-ink">
          Rodada {round.roundNumber}
          <Badge tone="info">Aberta</Badge>
        </h2>
        <p className="m-0 text-[13px] text-muted">
          Codebook v{round.codebookVersionNumber} · Prompt v{round.promptVersionNumber} ·
          aberta em {formatDate(round.createdAt)}
        </p>
      </div>

      <EffortList
        title="Avaliações enviadas"
        effort={effort}
        excluded={excluded}
        participation={participation}
        total={generated.length}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start gap-3">
          <ButtonLink href={generateHref}>Gerar respostas</ButtonLink>
          {close}
        </div>
        <p className="m-0 text-[13px] text-muted">
          {plural(generated.length, 'resposta nesta rodada', 'respostas nesta rodada')}
        </p>
      </div>

      <Disclosure summary={`Itens da rodada ${round.roundNumber} (${generated.length})`}>
        {generated.length === 0 ? (
          <p className="m-0 mt-2 text-[13px] text-muted">
            Nenhuma resposta gerada nesta rodada ainda.
          </p>
        ) : (
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {generated.map((response) => (
              <li
                key={response.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]"
              >
                <span className="font-semibold text-ink">{response.itemName}</span>
                <span className="text-muted">{formatDate(response.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Disclosure>
    </Card>
  )
}
