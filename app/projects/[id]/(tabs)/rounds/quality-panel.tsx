import { plural } from '@/lib/plural'
import type { Quality, QualityPair } from './quality'
import { QualityBar, QualityLegend } from './quality-bar'
import {
  QUALITY_LABEL,
  QUALITY_UNRATED,
  QUALITY_UNRATED_WITHOUT_OUTLIERS,
  levelsShareText,
  levelsText,
  qualityTotal,
} from './quality-labels'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  OUTLIER_PAIR_SUMMARY,
} from './agreement-labels'
import { StatCard } from '@/app/components/ui/stat'

function qualityText(quality: Quality, unrated: string): string {
  return quality.rated ? qualityTotal(quality.total) : unrated
}

function QualityStat({
  label,
  quality,
  unrated,
  hint,
}: {
  label: string
  quality: Quality
  unrated: string
  hint?: React.ReactNode
}) {
  return (
    <StatCard label={label} value={qualityText(quality, unrated)} hint={hint}>
      {quality.rated ? (
        <>
          <QualityBar levels={quality.levels} />
          <QualityLegend levels={quality.levels} />
        </>
      ) : null}
    </StatCard>
  )
}

export function QualityPanel({ pair }: { pair: QualityPair }) {
  const { all, withoutOutliers } = pair

  if (!withoutOutliers) {
    return <QualityStat label={QUALITY_LABEL} quality={all} unrated={QUALITY_UNRATED} />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <QualityStat
          label={`${QUALITY_LABEL} — ${AGREEMENT_ALL_LABEL}`}
          quality={all}
          unrated={QUALITY_UNRATED}
        />
        <QualityStat
          label={`${QUALITY_LABEL} — ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`}
          quality={withoutOutliers}
          unrated={QUALITY_UNRATED_WITHOUT_OUTLIERS}
          hint={plural(pair.excluded, 'avaliador fora', 'avaliadores fora')}
        />
      </div>

      <p className="m-0 text-xs text-muted">{OUTLIER_PAIR_SUMMARY}</p>
    </div>
  )
}

function distributionText(quality: Quality, unrated: string): string {
  if (!quality.rated) return unrated
  return levelsText(quality.levels)
}

function ValuePart({
  label,
  quality,
  unrated,
}: {
  label: string
  quality: Quality
  unrated: string
}) {
  return (
    <>
      <span>
        {label}:{' '}
        <span className="font-semibold text-ink">{distributionText(quality, unrated)}</span>
      </span>
      {quality.rated ? <span>{qualityTotal(quality.total)}</span> : null}
    </>
  )
}

export function QualityValue({ pair }: { pair: QualityPair }) {
  const { all, withoutOutliers } = pair

  return (
    <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
      <ValuePart
        label={withoutOutliers ? `${QUALITY_LABEL} ${AGREEMENT_ALL_LABEL}` : QUALITY_LABEL}
        quality={all}
        unrated={QUALITY_UNRATED}
      />
      {withoutOutliers ? (
        <>
          <span aria-hidden>·</span>
          <ValuePart
            label={AGREEMENT_WITHOUT_OUTLIERS_LABEL}
            quality={withoutOutliers}
            unrated={QUALITY_UNRATED_WITHOUT_OUTLIERS}
          />
        </>
      ) : null}
    </p>
  )
}

function SummaryPart({
  label,
  quality,
  unrated,
  size,
}: {
  label: string
  quality: Quality
  unrated: string
  size: 'md' | 'sm'
}) {
  if (!quality.rated) {
    return (
      <p className="m-0 text-[13px] text-muted">
        {label}: {unrated}
      </p>
    )
  }

  return (
    <>
      <QualityBar
        levels={quality.levels}
        size={size}
        title={`${levelsText(quality.levels)} · ${qualityTotal(quality.total)}`}
      />
      <p className="m-0 text-[13px] text-muted tabular-nums">
        {label}: {levelsShareText(quality.levels)} · {qualityTotal(quality.total)}
      </p>
    </>
  )
}

export function QualitySummary({ pair }: { pair: QualityPair }) {
  const { all, withoutOutliers } = pair

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <SummaryPart
        label={withoutOutliers ? `${QUALITY_LABEL} ${AGREEMENT_ALL_LABEL}` : QUALITY_LABEL}
        quality={all}
        unrated={QUALITY_UNRATED}
        size="sm"
      />
      {withoutOutliers ? (
        <SummaryPart
          label={AGREEMENT_WITHOUT_OUTLIERS_LABEL}
          quality={withoutOutliers}
          unrated={QUALITY_UNRATED_WITHOUT_OUTLIERS}
          size="sm"
        />
      ) : null}
    </div>
  )
}
