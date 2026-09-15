import { plural } from '@/lib/plural'
import type { Agreement } from '@/lib/agreement'
import type { EvaluatorEffort } from './agreement'
import {
  AGREEMENT_LABEL,
  BAND_REFERENCE,
  NOT_CALCULABLE_LABEL,
  agreementBand,
  bandLabel,
  bandTone,
  formatAlpha,
  notCalculableMessage,
  sampleSize,
  smallSampleWarning,
} from './agreement-labels'
import { Alert } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { StatCard } from '@/app/components/ui/stat'

function BandBadge({ alpha }: { alpha: number }) {
  const band = agreementBand(alpha)
  return <Badge tone={bandTone(band)}>{bandLabel(band)}</Badge>
}

function EffortList({ effort }: { effort: EvaluatorEffort[] }) {
  if (effort.length === 0) return null

  return (
    <Card tone="subtle" padding="sm">
      <span className="text-[13px] font-semibold text-label">
        Avaliações enviadas por avaliador
      </span>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
        {effort.map((evaluator) => (
          <li
            key={evaluator.projectMemberId}
            className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted"
          >
            <span className="text-ink">{evaluator.name}</span>
            <span>
              {plural(evaluator.submitted, 'avaliação enviada', 'avaliações enviadas')}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function AgreementPanel({
  agreement,
  responses,
  effort,
}: {
  agreement: Agreement
  responses: number
  effort: EvaluatorEffort[]
}) {
  const warning = smallSampleWarning({ raters: agreement.raters, responses })

  return (
    <div className="flex flex-col gap-3">
      <StatCard
        label={AGREEMENT_LABEL}
        value={
          agreement.calculable ? formatAlpha(agreement.alpha) : NOT_CALCULABLE_LABEL
        }
        badge={agreement.calculable ? <BandBadge alpha={agreement.alpha} /> : null}
        hint={
          <>
            {sampleSize(agreement)} ·{' '}
            {plural(responses, 'resposta avaliada', 'respostas avaliadas')}
            <br />
            {agreement.calculable
              ? BAND_REFERENCE
              : notCalculableMessage(agreement.reason)}
          </>
        }
      />

      {warning ? <Alert tone="notice">{warning}</Alert> : null}

      <EffortList effort={effort} />
    </div>
  )
}

export function AgreementValue({ agreement }: { agreement: Agreement }) {
  return (
    <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
      <span>
        {AGREEMENT_LABEL}:{' '}
        <span className="font-semibold text-ink">
          {agreement.calculable ? formatAlpha(agreement.alpha) : NOT_CALCULABLE_LABEL}
        </span>
      </span>
      {agreement.calculable ? <BandBadge alpha={agreement.alpha} /> : null}
      <span>{sampleSize(agreement)}</span>
    </p>
  )
}
