import { Fragment } from 'react'
import type { Agreement } from '@/lib/agreement'
import type { EvaluatorEffort } from './agreement'
import type { CriterionAgreement, MatrixCell } from './agreement-matrix'
import { EffortList } from './effort-list'
import type { OutlierMark } from './outliers'
import type { RoundMark } from '../../round-usage'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  CELL_UNRATED_LABEL,
  CONCENTRATION_HELP,
  NOT_CALCULABLE_LABEL,
  OUTLIER_PAIR_POINTS,
  OUTLIER_PAIR_RESULT,
  OUTLIER_PAIR_SUMMARY,
  agreementBand,
  bandLabel,
  bandTone,
  formatAlpha,
  SMALL_SAMPLE_HELP,
  smallSampleWarning,
} from './agreement-labels'
import { Alert } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { Disclosure } from '@/app/components/ui/disclosure'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import { LearnMore } from '@/app/components/ui/learn-more'
import { cx } from '@/app/components/ui/cx'
import { preWrapClass, scrollBoxClass } from '@/app/components/ui/prose'
import { formatDate } from '@/app/notifications/labels'

export type RoundSample = { raters: number; responses: number }

export type SamplePair = { all: RoundSample; withoutOutliers: RoundSample | null }

const reasonClass =
  'm-0 mt-1.5 rounded-card border border-line bg-surface px-3 py-2 text-[13px] text-ink'

function BandBadge({ alpha }: { alpha: number }) {
  const band = agreementBand(alpha)
  return <Badge tone={bandTone(band)}>{bandLabel(band)}</Badge>
}

function agreementText(agreement: Agreement): string {
  return agreement.calculable ? formatAlpha(agreement.alpha) : NOT_CALCULABLE_LABEL
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

export function AgreementWarnings({
  sample,
  concentrations,
}: {
  sample: SamplePair
  concentrations: string[]
}) {
  const { all, withoutOutliers } = sample

  const warnings: { key: string; text: string; help: string }[] = []
  const allWarning = smallSampleWarning(all)
  if (allWarning) {
    warnings.push({
      key: 'all',
      text: withoutOutliers ? `${AGREEMENT_ALL_LABEL} — ${allWarning}` : allWarning,
      help: SMALL_SAMPLE_HELP,
    })
  }
  if (withoutOutliers) {
    const filteredWarning = smallSampleWarning(withoutOutliers)
    if (filteredWarning) {
      warnings.push({
        key: 'without',
        text: `${AGREEMENT_WITHOUT_OUTLIERS_LABEL} — ${filteredWarning}`,
        help: SMALL_SAMPLE_HELP,
      })
    }
  }
  concentrations.forEach((text, index) => {
    warnings.push({ key: `concentration-${index}`, text, help: CONCENTRATION_HELP })
  })

  if (warnings.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {warnings.map((warning) => (
        <Alert key={warning.key} tone="notice">
          {warning.text} <InfoTooltip text={warning.help} />
        </Alert>
      ))}
    </div>
  )
}

export function AgreementNotes({
  effort,
  outliers,
  participation,
}: {
  effort: EvaluatorEffort[]
  outliers: OutlierMark[]
  participation?: Readonly<Record<string, RoundMark>>
}) {
  const excluded = new Set(outliers.map((mark) => mark.projectMemberId))

  if (outliers.length === 0 && effort.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {outliers.length > 0 ? (
        <>
          <p className="m-0 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{OUTLIER_PAIR_RESULT}</span>
            <InfoTooltip text={OUTLIER_PAIR_SUMMARY} />
          </p>

          <LearnMore points={OUTLIER_PAIR_POINTS} />

          <ExcludedList outliers={outliers} />
        </>
      ) : null}

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

type CriterionValue = { key: string; name: string; cell: MatrixCell }

function CriterionValues({
  label,
  values,
  band,
}: {
  label: string
  values: CriterionValue[]
  band: boolean
}) {
  return (
    <>
      <span>{label}:</span>
      {values.map(({ key, name, cell }, index) => (
        <Fragment key={key}>
          {index > 0 ? <span aria-hidden>·</span> : null}
          <span>
            {name}{' '}
            <span className="font-semibold text-ink">
              {cell.state === 'calculated' ? agreementText(cell.agreement) : CELL_UNRATED_LABEL}
            </span>
          </span>
          {band && cell.state === 'calculated' && cell.agreement.calculable ? (
            <BandBadge alpha={cell.agreement.alpha} />
          ) : null}
        </Fragment>
      ))}
    </>
  )
}

export function AgreementValue({
  rows,
  band = true,
}: {
  rows: readonly CriterionAgreement<unknown>[]
  band?: boolean
}) {
  if (rows.length === 0) return null

  const filtered = rows.some((row) => row.withoutOutliers !== null)

  return (
    <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
      <CriterionValues
        label={filtered ? `${AGREEMENT_LABEL} ${AGREEMENT_ALL_LABEL}` : AGREEMENT_LABEL}
        values={rows.map(({ column, cell }) => ({ key: column.key, name: column.name, cell }))}
        band={band}
      />
      {filtered ? (
        <>
          <span aria-hidden>·</span>
          <CriterionValues
            label={AGREEMENT_WITHOUT_OUTLIERS_LABEL}
            values={rows.map(({ column, cell, withoutOutliers }) => ({
              key: column.key,
              name: column.name,
              cell: withoutOutliers ?? cell,
            }))}
            band={band}
          />
        </>
      ) : null}
    </p>
  )
}
