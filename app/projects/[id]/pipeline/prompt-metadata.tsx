import type { PromptMetadata } from './prompt'

const FIELDS: { key: keyof PromptMetadata; label: string }[] = [
  { key: 'name', label: 'Nome' },
  { key: 'description', label: 'Descrição' },
  { key: 'changeLog', label: 'Registro de mudanças' },
]

export function PromptMetadataList({ version }: { version: PromptMetadata }) {
  const filled = FIELDS.filter(({ key }) => version[key])
  if (filled.length === 0) return null

  return (
    <dl className="m-0 flex flex-col gap-2">
      {filled.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-0.5">
          <dt className="text-[13px] font-semibold text-label">{label}</dt>
          <dd className="m-0 text-[13px] break-words whitespace-pre-wrap text-ink">
            {version[key]}
          </dd>
        </div>
      ))}
    </dl>
  )
}
