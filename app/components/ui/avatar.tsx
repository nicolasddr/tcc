import { cx } from './cx'

const shape = 'h-8 w-8 shrink-0 rounded-full'

export function Avatar({
  src,
  fallback,
  className,
}: {
  src?: string
  fallback: string
  className?: string
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cx(shape, 'object-cover', className)} />
  }

  return (
    <span
      className={cx(
        shape,
        'flex items-center justify-center bg-neutral-fg text-[13px] font-semibold',
        'text-white uppercase',
        className,
      )}
    >
      {fallback}
    </span>
  )
}
