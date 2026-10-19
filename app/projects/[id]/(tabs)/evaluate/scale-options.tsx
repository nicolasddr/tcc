'use client'

import { useEffect, useId, useState } from 'react'
import { SCALE, isScaleValue, scaleLabel, type ScaleValue } from './scale'
import { ScaleMarker } from './scale-marker'
import type { CodebookCriterion } from '../../pipeline/codebook'
import { buttonClass } from '@/app/components/ui/button'
import { cx } from '@/app/components/ui/cx'
import { preWrapClass } from '@/app/components/ui/prose'

const selected = 'border-brand! bg-brand-tint! text-brand-hover!'

export function ScaleOptions({
  criterion,
  value,
  disabled,
  onChange,
}: {
  criterion: CodebookCriterion
  value: string
  disabled: boolean
  onChange: (value: ScaleValue | '') => void
}) {
  const id = useId()
  const [hinted, setHinted] = useState<ScaleValue | null>(null)
  const chosen = isScaleValue(value) ? criterion.levels[value] : null

  useEffect(() => {
    if (hinted === null) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setHinted(null)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [hinted])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <div
          role="group"
          aria-label={`Nota de ${criterion.name}`}
          className="flex flex-wrap gap-2"
        >
          {SCALE.map((option) => {
            const active = value === option
            const described = criterion.levels[option] !== null
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                aria-describedby={described ? `${id}-${option}` : undefined}
                disabled={disabled}
                onClick={() => onChange(active ? '' : option)}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setHinted(option)
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') setHinted(null)
                }}
                onFocus={(event) => {
                  if (event.currentTarget.matches(':focus-visible')) setHinted(option)
                }}
                onBlur={() => setHinted(null)}
                className={buttonClass('secondary', {
                  className: cx('max-sm:px-3!', active && selected),
                })}
              >
                <ScaleMarker value={option} />
                {scaleLabel(option)}
              </button>
            )
          })}
        </div>

        {SCALE.map((option) => {
          const text = criterion.levels[option]
          if (text === null) return null
          return (
            <span
              key={option}
              id={`${id}-${option}`}
              role="tooltip"
              className={cx(
                'absolute top-full left-0 z-50 mt-2 w-[min(320px,calc(100vw-3rem))] rounded-control bg-ink-soft px-3 py-2.5 text-left text-[12.5px] leading-[1.5] font-normal whitespace-pre-wrap text-surface shadow-[0_4px_12px_rgba(0,0,0,0.18)]',
                hinted === option && value !== option ? 'block' : 'hidden',
              )}
            >
              {text}
            </span>
          )
        })}
      </div>

      {isScaleValue(value) && chosen ? (
        <p className={cx('m-0 text-xs text-muted', preWrapClass)}>
          {`${scaleLabel(value)}: ${chosen}`}
        </p>
      ) : null}
    </div>
  )
}
