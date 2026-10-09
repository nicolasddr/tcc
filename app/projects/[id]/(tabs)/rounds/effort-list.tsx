import { plural } from '@/lib/plural'
import type { EvaluatorEffort } from './agreement'
import { PARTICIPATION_HELP } from './participation-labels'
import type { RoundMark } from '../../round-usage'
import { RoundMarkBadge } from '../../round-mark-badge'
import { Badge } from '@/app/components/ui/badge'
import { ProgressBar } from '@/app/components/ui/stat'
import { InfoTooltip } from '@/app/components/ui/tooltip'

const DEACTIVATED_HELP =
  'O avaliador desativado continua nesta lista porque as notas que ele enviou nesta ' +
  'rodada continuam gravadas e continuam no cálculo. Desativar é sobre acesso, e só ' +
  'tira a pessoa do acompanhamento de quem ainda falta terminar.'

export function EffortList({
  title,
  effort,
  excluded,
  participation,
  total,
}: {
  title: string
  effort: EvaluatorEffort[]
  excluded: ReadonlySet<string>
  participation?: Readonly<Record<string, RoundMark>>
  total?: number
}) {
  if (effort.length === 0) return null

  const deactivated = effort.some((evaluator) => evaluator.status !== 'active')
  const marked = effort.some((evaluator) => participation?.[evaluator.projectMemberId])
  const help = [deactivated ? DEACTIVATED_HELP : null, marked ? PARTICIPATION_HELP : null]
    .filter((text) => text !== null)
    .join('\n\n')

  return (
    <div>
      <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-label">
        {title}
        {help ? <InfoTooltip text={help} /> : null}
      </span>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
        {effort.map((evaluator) => (
          <li key={evaluator.projectMemberId} className="flex flex-col gap-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-ink">{evaluator.name}</span>
                {excluded.has(evaluator.projectMemberId) ? (
                  <Badge tone="warning">outlier</Badge>
                ) : null}
                {evaluator.status === 'active' ? null : (
                  <Badge tone="neutral">desativado</Badge>
                )}
                {participation?.[evaluator.projectMemberId] ? (
                  <RoundMarkBadge mark={participation[evaluator.projectMemberId]} />
                ) : null}
              </span>
              <span>
                {total === undefined
                  ? plural(evaluator.submitted, 'avaliação enviada', 'avaliações enviadas')
                  : `${evaluator.submitted} de ${total}`}
              </span>
            </span>
            {total === undefined ? null : (
              <ProgressBar value={evaluator.submitted} max={total} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
