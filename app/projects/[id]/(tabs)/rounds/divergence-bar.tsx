import type { AgreementProfile } from '@/lib/agreement'
import { cx } from '@/app/components/ui/cx'
import { divergenceBarLabel } from './divergence'
import { formatShare } from './share'

export const DIVERGENCE_SEGMENT_CLASS = {
  equal: 'bg-faint',
  adjacent: 'bg-warning',
  extreme: 'bg-danger',
} as const

const SEGMENTS = ['equal', 'adjacent', 'extreme'] as const

export function DivergenceBar({ profile }: { profile: AgreementProfile }) {
  const label = divergenceBarLabel(profile)

  return (
    <span className="flex w-full flex-col gap-[3px]">
      <span
        role="img"
        aria-label={label}
        title={label}
        className="flex h-2 w-full overflow-hidden rounded-full bg-line"
      >
        {SEGMENTS.map((segment) =>
          profile[segment] > 0 ? (
            <span
              key={segment}
              className={cx('block h-full', DIVERGENCE_SEGMENT_CLASS[segment])}
              style={{ width: `${profile[segment] * 100}%` }}
            />
          ) : null,
        )}
      </span>
      <span className="flex justify-between gap-2.5 text-[11.5px] tabular-nums">
        <span className="text-label">{formatShare(profile.equal)}</span>
        <span className="text-warning-fg">{formatShare(profile.adjacent)}</span>
        <span
          className={profile.extreme > 0 ? 'font-semibold text-danger-fg' : 'text-faint'}
        >
          {formatShare(profile.extreme)}
        </span>
      </span>
    </span>
  )
}
