import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { cx } from '@/app/components/ui/cx'
import { Disclosure } from '@/app/components/ui/disclosure'
import { preWrapClass, scrollBoxClass } from '@/app/components/ui/prose'
import { definitionTypeLabel } from '@/app/projects/definition-types'
import { formatDate } from '@/app/notifications/labels'
import { CONSENSUS_NOTE_MAX } from '@/lib/limits'
import type { CodebookCriterion, CodebookDefinition } from '../../pipeline/codebook'
import { scaleLabel, scaleTone } from '../evaluate/scale'
import type { ConsensusNote } from './consensus'
import { consensusCellKey, type CellConsensus } from './consensus-cells'
import { ConsensusForm } from './consensus-form'
import {
  DIVERGENCE_LEGEND,
  NO_JUSTIFICATION_HINT,
  NO_JUSTIFICATION_LABEL,
  divergenceLabel,
  divergenceMeaning,
  divergenceTone,
  isDivergent,
} from './divergence'
import type { ReviewCell, ReviewGroup, ReviewNote } from './review-groups'

export type DefinitionGroup = ReviewGroup<CodebookDefinition, CodebookCriterion>

export const OUTLIER_NOTE_LABEL = 'outlier'

export const MINUTES_LABEL = 'Ata da discussão'

export const MINUTES_FIELD_LABEL = 'O que a equipe decidiu nesta célula'

export const MINUTES_HINT =
  'A ata registra o que a equipe decidiu nesta célula, e fica visível para quem avaliou ' +
  `nesta rodada. Até ${CONSENSUS_NOTE_MAX} caracteres. Salvar com o campo vazio remove a ata.`

export type ConsensusContext = {
  projectId: string
  roundId: string
  responseId: string
  canWriteMinutes: boolean
  byCell: ReadonlyMap<string, CellConsensus>
}

export function minutesByline(note: ConsensusNote): string {
  return `por ${note.authorName}, ${formatDate(note.updatedAt)}`
}

export function outlierNoteHint(reason: string | null): string {
  const mark =
    'Marcado como outlier nesta rodada: as notas desta pessoa ficam fora do cálculo ' +
    'da rodada, e continuam aqui na revisão, com o mesmo peso das outras.'

  return reason ? `${mark} Justificativa: ${reason}` : mark
}

export function divergenceSummary(divergent: number, cells: number): string {
  if (cells === 0) return 'sem célula nesta definição'
  if (divergent === 0) return 'nenhuma divergência'

  const noun = cells === 1 ? 'célula' : 'células'
  const verb = divergent === 1 ? 'diverge' : 'divergem'

  return `${divergent} de ${cells} ${noun} ${verb}`
}

function Note({ note }: { note: ReviewNote }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[13px] font-semibold text-ink">{note.evaluatorName}</span>
        <Badge tone={scaleTone(note.value)}>{scaleLabel(note.value)}</Badge>
        {note.isOutlier ? (
          <span title={outlierNoteHint(note.outlierReason)}>
            <Badge tone="warning">{OUTLIER_NOTE_LABEL}</Badge>
          </span>
        ) : null}
      </span>

      {note.justification ? (
        <Disclosure summary={<span title={note.justification}>Justificativa</span>}>
          <p
            className={cx(
              'm-0 mt-1.5 rounded-card border border-line bg-surface-subtle px-3 py-2',
              'text-[13px] text-ink',
              scrollBoxClass,
              preWrapClass,
            )}
          >
            {note.justification}
          </p>
        </Disclosure>
      ) : (
        <span className="text-[12.5px] text-muted" title={NO_JUSTIFICATION_HINT}>
          {NO_JUSTIFICATION_LABEL}
        </span>
      )}
    </li>
  )
}

function Minutes({ note }: { note: ConsensusNote }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="text-[12.5px] font-semibold text-label">{MINUTES_LABEL}</span>
      <p
        className={cx(
          'm-0 rounded-card border border-line bg-surface-subtle px-3 py-2',
          'text-[13px] text-ink',
          scrollBoxClass,
          preWrapClass,
        )}
      >
        {note.text}
      </p>
      <span className="text-[12px] text-muted">{minutesByline(note)}</span>
    </li>
  )
}

function ConsensusCell({
  consensus,
  definitionId,
  criterionId,
}: {
  consensus: ConsensusContext
  definitionId: string
  criterionId: string
}) {
  const cell = consensus.byCell.get(consensusCellKey(definitionId, criterionId))
  const minutes = cell?.minutes ?? []

  if (minutes.length === 0 && !consensus.canWriteMinutes) return null

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-2.5">
      {minutes.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {minutes.map((note) => (
            <Minutes key={note.id} note={note} />
          ))}
        </ul>
      ) : null}

      {consensus.canWriteMinutes ? (
        <Disclosure summary={cell?.mine ? 'Editar a ata' : 'Registrar a decisão'}>
          <ConsensusForm
            projectId={consensus.projectId}
            roundId={consensus.roundId}
            responseId={consensus.responseId}
            definitionId={definitionId}
            criterionId={criterionId}
            note={cell?.mine ?? null}
            label={MINUTES_FIELD_LABEL}
            hint={MINUTES_HINT}
            placeholder="Ex.: mantivemos alto; a divergência era sobre o que conta como fonte."
            submitLabel="Salvar ata"
            savedMessage="Ata salva."
            removedMessage="Ata removida."
          />
        </Disclosure>
      ) : null}
    </div>
  )
}

function Cell({
  cell,
  definitionId,
  consensus,
}: {
  cell: ReviewCell<CodebookCriterion>
  definitionId: string
  consensus: ConsensusContext | null
}) {
  return (
    <li>
      <Card padding="sm" tone={isDivergent(cell.divergence) ? 'accent' : 'default'}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold text-ink">
            {cell.criterion.name}
          </span>
          {cell.isGeneral ? <Badge tone="neutral">geral</Badge> : null}
          <span title={divergenceMeaning(cell.divergence)}>
            <Badge tone={divergenceTone(cell.divergence)}>
              {divergenceLabel(cell.divergence)}
            </Badge>
          </span>
        </div>

        {cell.notes.length === 0 ? (
          <p className="m-0 mt-2 text-[12.5px] text-muted">
            {divergenceMeaning(cell.divergence)}
          </p>
        ) : (
          <ul className="m-0 mt-2 flex list-none flex-col gap-2.5 p-0">
            {cell.notes.map((note) => (
              <Note key={note.projectMemberId} note={note} />
            ))}
          </ul>
        )}

        {consensus ? (
          <ConsensusCell
            consensus={consensus}
            definitionId={definitionId}
            criterionId={cell.criterion.id}
          />
        ) : null}
      </Card>
    </li>
  )
}

function Group({
  group,
  consensus,
}: {
  group: DefinitionGroup
  consensus: ConsensusContext | null
}) {
  const { definition } = group

  return (
    <li>
      <Disclosure
        defaultOpen={group.divergent > 0}
        summary={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-ink">{definition.title}</span>
            <Badge tone="neutral">
              {definitionTypeLabel(definition.type) ?? definition.type}
            </Badge>
            <span className="text-[12.5px] font-normal text-muted">
              {divergenceSummary(group.divergent, group.cells.length)}
            </span>
          </span>
        }
      >
        {group.cells.length === 0 ? (
          <p className="m-0 mt-2 text-[13px] text-muted">
            Esta definição não tem critério nesta versão do codebook, então não há
            célula para revisar nela.
          </p>
        ) : (
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {group.cells.map((cell) => (
              <Cell
                key={cell.criterion.id}
                cell={cell}
                definitionId={definition.id}
                consensus={consensus}
              />
            ))}
          </ul>
        )}
      </Disclosure>
    </li>
  )
}

export function ReviewGroupsList({
  groups,
  consensus,
}: {
  groups: DefinitionGroup[]
  consensus: ConsensusContext | null
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {groups.map((group) => (
          <Group key={group.definition.id} group={group} consensus={consensus} />
        ))}
      </ul>

      <p className="m-0 text-xs text-muted">{DIVERGENCE_LEGEND}</p>
    </div>
  )
}
