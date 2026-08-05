export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        className="inline-flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full border border-line-strong bg-surface text-[11px] font-bold text-muted transition-colors hover:border-muted hover:text-ink focus-visible:ring-[3px] focus-visible:ring-brand-ring focus-visible:outline-none"
      >
        i
      </button>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-0 z-50 mt-2 w-[min(320px,calc(100vw-3rem))] rounded-control bg-ink-soft px-3 py-2.5 text-left text-[12.5px] leading-[1.5] font-normal whitespace-pre-wrap text-surface opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.18)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
