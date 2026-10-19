import type { MeasuredCell } from './agreement-matrix'
import type { Quality, QualityPair } from './quality'
import { QualityBar } from './quality-bar'
import {
  QUALITY_UNRATED,
  QUALITY_UNRATED_WITHOUT_OUTLIERS,
  levelShares,
  levelsText,
} from './quality-labels'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  CELL_NOT_APPLICABLE,
  CELL_UNRATED_LABEL,
} from './agreement-labels'

function Levels({
  label,
  quality,
  unrated,
}: {
  label?: string
  quality: Quality
  unrated: string
}) {
  return (
    <span
      className="flex min-w-24 flex-col gap-1"
      title={quality.rated ? levelsText(quality.levels) : undefined}
    >
      {label ? <span className="text-[11px] text-muted">{label}</span> : null}
      {quality.rated ? (
        <>
          <QualityBar levels={quality.levels} size="sm" />
          <span className="text-xs whitespace-nowrap text-muted tabular-nums">
            {levelShares(quality.levels)}
          </span>
        </>
      ) : (
        <span className="text-muted">{unrated}</span>
      )}
    </span>
  )
}

export function QualityCell({
  cell,
  notApplicableTitle,
}: {
  cell: MeasuredCell<QualityPair>
  notApplicableTitle?: string
}) {
  if (cell.state === 'not_applicable') {
    return (
      <span className="text-muted" title={notApplicableTitle}>
        {CELL_NOT_APPLICABLE}
      </span>
    )
  }

  if (cell.state === 'unrated') {
    return <span className="text-muted">{CELL_UNRATED_LABEL}</span>
  }

  const { all, withoutOutliers } = cell.value

  if (!withoutOutliers) {
    return <Levels quality={all} unrated={QUALITY_UNRATED} />
  }

  return (
    <span className="flex flex-col gap-2">
      <Levels label={AGREEMENT_ALL_LABEL} quality={all} unrated={QUALITY_UNRATED} />
      <Levels
        label={AGREEMENT_WITHOUT_OUTLIERS_LABEL}
        quality={withoutOutliers}
        unrated={QUALITY_UNRATED_WITHOUT_OUTLIERS}
      />
    </span>
  )
}
