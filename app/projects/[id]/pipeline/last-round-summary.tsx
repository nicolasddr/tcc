import { Card } from '@/app/components/ui/card'
import { formatDate } from '@/app/notifications/labels'
import {
  weakestCriterion,
  type RoundAgreements,
} from '../(tabs)/rounds/agreement-matrix'
import type { VersionPair } from '../(tabs)/rounds/reference-round'
import { AgreementValue } from '../(tabs)/rounds/agreement-panel'
import {
  BAND_REFERENCE,
  notCalculableMessage,
} from '../(tabs)/rounds/agreement-labels'
import type { QualityPair } from '../(tabs)/rounds/quality'
import { QualityValue } from '../(tabs)/rounds/quality-panel'
import { QUALITY_LABEL } from '../(tabs)/rounds/quality-labels'
import { PHASE_4 } from './preconditions'

export type LastClosedRound = {
  roundNumber: number
  closedAt: string | null
  agreement: RoundAgreements
  quality?: QualityPair
}

export const QUALITY_REFERENCE =
  `A ${QUALITY_LABEL} não tem faixa de referência: quem julga se a distribuição basta ` +
  'é o Administrador.'

export function LastRoundSummary({
  round,
  reference,
}: {
  round: LastClosedRound
  reference?: VersionPair
}) {
  const weakest = weakestCriterion(round.agreement)

  return (
    <Card tone="subtle" padding="sm">
      <span className="text-[13px] font-semibold text-ink">
        {reference ? 'Rodada de referência' : 'Última rodada fechada'}: rodada {round.roundNumber}
        {round.closedAt ? ` · fechada em ${formatDate(round.closedAt)}` : null}
      </span>
      {reference ? (
        <p className="m-0 mt-0.5 text-xs text-muted">
          Codebook na versão {reference.codebook} e prompt na versão {reference.prompt}: são as
          versões que a Fase {PHASE_4} vai testar.
        </p>
      ) : null}
      <AgreementValue rows={round.agreement} />
      <p className="m-0 mt-1.5 text-xs text-muted">
        {weakest && !weakest.agreement.calculable
          ? `${weakest.column.name}: ${notCalculableMessage(weakest.agreement.reason)}`
          : BAND_REFERENCE}
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
