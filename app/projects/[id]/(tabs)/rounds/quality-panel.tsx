import { plural } from '@/lib/plural'
import { scaleLabel } from '../evaluate/scale'
import type { Quality, QualityLevel, QualityPair } from './quality'
import {
  QUALITY_LABEL,
  QUALITY_UNRATED,
  QUALITY_UNRATED_WITHOUT_OUTLIERS,
  formatShare,
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

function QualityLevels({ levels }: { levels: QualityLevel[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {levels.map((level) => (
        <li key={level.value} className="flex flex-col gap-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted">
            <span className="font-semibold text-ink">{scaleLabel(level.value)}</span>
            <span>
              <span className="font-semibold text-ink">{formatShare(level.share)}</span>
              {' · '}
              {qualityTotal(level.count)}
            </span>
          </span>
          <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-faint"
              style={{ width: `${level.share * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
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
      {quality.rated ? <QualityLevels levels={quality.levels} /> : null}
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
  return quality.levels
    .map((level) => `${scaleLabel(level.value)} ${formatShare(level.share)} (${level.count})`)
    .join(' · ')
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
