export function ByDefinition({
  summary,
  children,
}: {
  summary: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="m-0 text-[13px] font-semibold text-ink">{summary}</h3>
      {children}
    </div>
  )
}
