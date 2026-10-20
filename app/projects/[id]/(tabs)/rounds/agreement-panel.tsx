import { plural } from '@/lib/plural'
import type { Agreement, AgreementProfile } from '@/lib/agreement'
import type { EvaluatorEffort } from './agreement'
import { EffortList } from './effort-list'
import type { AgreementPair, ProfilePair } from './agreement-pair'
import type { OutlierMark } from './outliers'
import type { RoundMark } from '../../round-usage'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  BAND_REFERENCE,
  BAND_REFERENCE_LABEL,
  CONCENTRATION_HELP,
  NOT_CALCULABLE_LABEL,
  OUTLIER_PAIR_POINTS,
  OUTLIER_PAIR_RESULT,
  OUTLIER_PAIR_SUMMARY,
  agreementBand,
  bandLabel,
  bandTone,
  concentrationWarning,
  distributionLine,
  formatAlpha,
  notCalculableMessage,
  profileLine,
  SMALL_SAMPLE_HELP,
  sampleSize,
  smallSampleWarning,
} from './agreement-labels'
import { Alert } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { Disclosure } from '@/app/components/ui/disclosure'
import { StatCard } from '@/app/components/ui/stat'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { LearnMore } from '@/app/components/ui/learn-more'
import { cx } from '@/app/components/ui/cx'
import { preWrapClass, scrollBoxClass } from '@/app/components/ui/prose'
import { formatDate } from '@/app/notifications/labels'

export type ResponseCounts = { all: number; withoutOutliers: number }

const reasonClass =
  'm-0 mt-1.5 rounded-card border border-line bg-surface px-3 py-2 text-[13px] text-ink'

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

function ProfileLine({
  profile,
  distribution,
}: {
  profile: AgreementProfile | null
  distribution: boolean
}) {
  if (!profile) return null
  return (
    <>
      <br />
      {profileLine(profile)}
      {distribution ? (
        <>
          <br />
          {distributionLine(profile)}
        </>
      ) : null}
    </>
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
                <Badge tone="warning">Outlier</Badge>
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
  profiles,
  responses,
  effort,
  outliers,
  distribution,
  participation,
}: {
  pair: AgreementPair
  profiles: ProfilePair
  responses: ResponseCounts
  effort: EvaluatorEffort[]
  outliers: OutlierMark[]
  distribution: boolean
  participation?: Readonly<Record<string, RoundMark>>
}) {
  const { all, withoutOutliers } = pair
  const excluded = new Set(outliers.map((mark) => mark.projectMemberId))

  const warnings: { key: string; text: string; help: string }[] = []
  const allWarning = smallSampleWarning({
    raters: all.raters,
    responses: responses.all,
  })
  if (allWarning) {
    warnings.push({
      key: 'all',
      text: withoutOutliers ? `${AGREEMENT_ALL_LABEL} — ${allWarning}` : allWarning,
      help: SMALL_SAMPLE_HELP,
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
        help: SMALL_SAMPLE_HELP,
      })
    }
  }
  const allConcentration = concentrationWarning(all, profiles.all)
  if (allConcentration) {
    warnings.push({
      key: 'all-concentration',
      text: withoutOutliers
        ? `${AGREEMENT_ALL_LABEL} — ${allConcentration}`
        : allConcentration,
      help: CONCENTRATION_HELP,
    })
  }
  if (withoutOutliers) {
    const filteredConcentration = concentrationWarning(
      withoutOutliers,
      profiles.withoutOutliers,
    )
    if (filteredConcentration) {
      warnings.push({
        key: 'without-concentration',
        text: `${AGREEMENT_WITHOUT_OUTLIERS_LABEL} — ${filteredConcentration}`,
        help: CONCENTRATION_HELP,
      })
    }
  }

  const allHint = (
    <>
      {sampleSize(all)} ·{' '}
      {plural(responses.all, 'resposta avaliada', 'respostas avaliadas')}
      {all.calculable ? (
        <>
          {' '}
          ·{' '}
          <span className="whitespace-nowrap">
            {BAND_REFERENCE_LABEL} <InfoTooltip text={BAND_REFERENCE} />
          </span>
          <ProfileLine profile={profiles.all} distribution={distribution} />
        </>
      ) : (
        <>
          <ProfileLine profile={profiles.all} distribution={distribution} />
          <br />
          {notCalculableMessage(all.reason)}
        </>
      )}
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
                  <ProfileLine
                    profile={profiles.withoutOutliers}
                    distribution={distribution}
                  />
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
            <span>{OUTLIER_PAIR_RESULT}</span>
            <InfoTooltip text={OUTLIER_PAIR_SUMMARY} />
          </p>

          <LearnMore points={OUTLIER_PAIR_POINTS} />

          <ExcludedList outliers={outliers} />
        </>
      ) : (
        <AgreementStat label={AGREEMENT_LABEL} agreement={all} hint={allHint} />
      )}

      {warnings.map((warning) => (
        <Alert key={warning.key} tone="notice">
          {warning.text} <InfoTooltip text={warning.help} />
        </Alert>
      ))}

      {effort.length > 0 ? (
        <Card tone="subtle" padding="sm">
          <EffortList
            title="Avaliações enviadas por avaliador"
            effort={effort}
            excluded={excluded}
            participation={participation}
          />
        </Card>
      ) : null}
    </div>
  )
}

function ValuePart({
  label,
  agreement,
  band,
}: {
  label: string
  agreement: Agreement
  band: boolean
}) {
  return (
    <>
      <span>
        {label}:{' '}
        <span className="font-semibold text-ink">{agreementText(agreement)}</span>
      </span>
      {band && agreement.calculable ? <BandBadge alpha={agreement.alpha} /> : null}
      <span>{sampleSize(agreement)}</span>
    </>
  )
}

export function AgreementValue({
  pair,
  band = true,
}: {
  pair: AgreementPair
  band?: boolean
}) {
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
        band={band}
      />
      {withoutOutliers ? (
        <>
          <span aria-hidden>·</span>
          <ValuePart
            label={AGREEMENT_WITHOUT_OUTLIERS_LABEL}
            agreement={withoutOutliers}
            band={band}
          />
        </>
      ) : null}
    </p>
  )
}
