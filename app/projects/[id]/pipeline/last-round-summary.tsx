import { Card } from '@/app/components/ui/card'
import { formatDate } from '@/app/notifications/labels'
import type { AgreementPair } from '../(tabs)/rounds/agreement-pair'
import { AgreementValue } from '../(tabs)/rounds/agreement-panel'
import {
  BAND_REFERENCE,
  notCalculableMessage,
} from '../(tabs)/rounds/agreement-labels'
import type { QualityPair } from '../(tabs)/rounds/quality'
import { QualityValue } from '../(tabs)/rounds/quality-panel'
import { QUALITY_LABEL } from '../(tabs)/rounds/quality-labels'

export type LastClosedRound = {
  roundNumber: number
  closedAt: string | null
  pair: AgreementPair
  quality?: QualityPair
}

export const QUALITY_REFERENCE =
  `A ${QUALITY_LABEL} não tem faixa de referência: quem julga se a distribuição basta ` +
  'é o Administrador.'

export function LastRoundSummary({ round }: { round: LastClosedRound }) {
  const { all } = round.pair

  return (
    <Card tone="subtle" padding="sm">
      <span className="text-[13px] font-semibold text-ink">
        Última rodada fechada: rodada {round.roundNumber}
        {round.closedAt ? ` · fechada em ${formatDate(round.closedAt)}` : null}
      </span>
      <AgreementValue pair={round.pair} />
      <p className="m-0 mt-1.5 text-xs text-muted">
        {all.calculable ? BAND_REFERENCE : notCalculableMessage(all.reason)}
      </p>
      {round.quality ? (
        <div className="mt-3 border-t border-line pt-3">
          <QualityValue pair={round.quality} />
          <p className="m-0 mt-1.5 text-xs text-muted">{QUALITY_REFERENCE}</p>
        </div>
      ) : null}
    </Card>
  )
}
