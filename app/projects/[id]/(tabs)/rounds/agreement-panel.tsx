import { plural } from '@/lib/plural'
import type { Agreement } from '@/lib/agreement'
import type { EvaluatorEffort } from './agreement'
import type { AgreementPair } from './agreement-pair'
import type { OutlierMark } from './outliers'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  BAND_REFERENCE,
  NOT_CALCULABLE_LABEL,
  OUTLIER_PAIR_HINT,
  OUTLIER_PAIR_SUMMARY,
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
import { Disclosure } from '@/app/components/ui/disclosure'
import { StatCard } from '@/app/components/ui/stat'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { cx } from '@/app/components/ui/cx'
import { preWrapClass, scrollBoxClass } from '@/app/components/ui/prose'
import { formatDate } from '@/app/notifications/labels'

export type ResponseCounts = { all: number; withoutOutliers: number }

const reasonClass =
  'm-0 mt-1.5 rounded-card border border-line bg-surface px-3 py-2 text-[13px] text-ink'

const DEACTIVATED_HELP =
  'O avaliador desativado continua nesta lista porque as notas que ele enviou nesta ' +
  'rodada continuam gravadas e continuam no cálculo. Desativar é sobre acesso, e só ' +
  'tira a pessoa do acompanhamento de quem ainda falta terminar.'

function BandBadge({ alpha }: { alpha: number }) {
  const band = agreementBand(alpha)
  return <Badge tone={bandTone(band)}>{bandLabel(band)}</Badge>
}

function agreementText(agreement: Agreement): string {
  return agreement.calculable ? formatAlpha(agreement.alpha) : NOT_CALCULABLE_LABEL
}

function AgreementStat({
  label,
  agreement,
  hint,
}: {
  label: string
  agreement: Agreement
  hint: React.ReactNode
}) {
  return (
    <StatCard
      label={label}
      value={agreementText(agreement)}
      badge={agreement.calculable ? <BandBadge alpha={agreement.alpha} /> : null}
      hint={hint}
    />
  )
}

function EffortList({
  effort,
  excluded,
}: {
  effort: EvaluatorEffort[]
  excluded: ReadonlySet<string>
}) {
  if (effort.length === 0) return null

  const deactivated = effort.some((evaluator) => evaluator.status !== 'active')

  return (
    <Card tone="subtle" padding="sm">
      <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-label">
        Avaliações enviadas por avaliador
        {deactivated ? <InfoTooltip text={DEACTIVATED_HELP} /> : null}
      </span>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
        {effort.map((evaluator) => (
          <li
            key={evaluator.projectMemberId}
            className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted"
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-ink">{evaluator.name}</span>
              {excluded.has(evaluator.projectMemberId) ? (
                <Badge tone="warning">outlier</Badge>
              ) : null}
              {evaluator.status === 'active' ? null : (
                <Badge tone="neutral">desativado</Badge>
              )}
            </span>
            <span>
              {plural(evaluator.submitted, 'avaliação enviada', 'avaliações enviadas')}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ExcludedList({ outliers }: { outliers: OutlierMark[] }) {
  if (outliers.length === 0) return null

  return (
    <Disclosure
      summary={`Quem saiu do cálculo e por quê (${outliers.length})`}
    >
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {outliers.map((mark) => (
          <li key={mark.id}>
            <Card tone="subtle" padding="sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-semibold text-ink">
                  {mark.evaluatorName}
                </span>
                <Badge tone="warning">outlier</Badge>
                <span className="text-[12.5px] text-muted">
                  marcado por {mark.markedByName} em {formatDate(mark.markedAt)}
                </span>
              </div>
              <p className={cx(reasonClass, scrollBoxClass, preWrapClass)}>
                {mark.reason}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </Disclosure>
  )
}

export function AgreementPanel({
  pair,
  responses,
  effort,
  outliers,
}: {
  pair: AgreementPair
  responses: ResponseCounts
  effort: EvaluatorEffort[]
  outliers: OutlierMark[]
}) {
  const { all, withoutOutliers } = pair
  const excluded = new Set(outliers.map((mark) => mark.projectMemberId))

  const warnings: { key: string; text: string }[] = []
  const allWarning = smallSampleWarning({
    raters: all.raters,
    responses: responses.all,
  })
  if (allWarning) {
    warnings.push({
      key: 'all',
      text: withoutOutliers ? `${AGREEMENT_ALL_LABEL} — ${allWarning}` : allWarning,
    })
  }
  if (withoutOutliers) {
    const filteredWarning = smallSampleWarning({
      raters: withoutOutliers.raters,
      responses: responses.withoutOutliers,
    })
    if (filteredWarning) {
      warnings.push({
        key: 'without',
        text: `${AGREEMENT_WITHOUT_OUTLIERS_LABEL} — ${filteredWarning}`,
      })
    }
  }

  const allHint = (
    <>
      {sampleSize(all)} ·{' '}
      {plural(responses.all, 'resposta avaliada', 'respostas avaliadas')}
      <br />
      {all.calculable ? BAND_REFERENCE : notCalculableMessage(all.reason)}
    </>
  )

  return (
    <div className="flex flex-col gap-3">
      {withoutOutliers ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <AgreementStat
              label={`${AGREEMENT_LABEL} — ${AGREEMENT_ALL_LABEL}`}
              agreement={all}
              hint={allHint}
            />
            <AgreementStat
              label={`${AGREEMENT_LABEL} — ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`}
              agreement={withoutOutliers}
              hint={
                <>
                  {sampleSize(withoutOutliers)} ·{' '}
                  {plural(
                    responses.withoutOutliers,
                    'resposta avaliada',
                    'respostas avaliadas',
                  )}{' '}
                  · {plural(pair.excluded, 'avaliador fora', 'avaliadores fora')}
                  {withoutOutliers.calculable ? null : (
                    <>
                      <br />
                      {notCalculableMessage(withoutOutliers.reason)}
                    </>
                  )}
                </>
              }
            />
          </div>

          <p className="m-0 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{OUTLIER_PAIR_SUMMARY}</span>
            <InfoTooltip text={OUTLIER_PAIR_HINT} />
          </p>

          <ExcludedList outliers={outliers} />
        </>
      ) : (
        <AgreementStat label={AGREEMENT_LABEL} agreement={all} hint={allHint} />
      )}

      {warnings.map((warning) => (
        <Alert key={warning.key} tone="notice">
          {warning.text}
        </Alert>
      ))}

      <EffortList effort={effort} excluded={excluded} />
    </div>
  )
}

function ValuePart({ label, agreement }: { label: string; agreement: Agreement }) {
  return (
    <>
      <span>
        {label}:{' '}
        <span className="font-semibold text-ink">{agreementText(agreement)}</span>
      </span>
      {agreement.calculable ? <BandBadge alpha={agreement.alpha} /> : null}
      <span>{sampleSize(agreement)}</span>
    </>
  )
}

export function AgreementValue({ pair }: { pair: AgreementPair }) {
  const { all, withoutOutliers } = pair

  return (
    <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
      <ValuePart
        label={
          withoutOutliers
            ? `${AGREEMENT_LABEL} ${AGREEMENT_ALL_LABEL}`
            : AGREEMENT_LABEL
        }
        agreement={all}
      />
      {withoutOutliers ? (
        <>
          <span aria-hidden>·</span>
          <ValuePart
            label={AGREEMENT_WITHOUT_OUTLIERS_LABEL}
            agreement={withoutOutliers}
          />
        </>
      ) : null}
    </p>
  )
}
