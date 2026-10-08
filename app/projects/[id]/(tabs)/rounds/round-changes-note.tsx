import { Alert } from '@/app/components/ui/alert'
import { Chip } from '@/app/components/ui/chip'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import type { Change, RoundChanges } from './round-changes'
import {
  CODEBOOK_AND_PROMPT_NOTICE,
  CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE,
  ENTERS_PHASE_3_NOTE,
  codebookChipText,
  entersPhase4Note,
  phaseChipText,
  promptChipText,
} from './round-changes-labels'

type ChipRound = {
  phase: number
  codebookVersionNumber: number
  promptVersionNumber: number
}

function noticeOf(changes: RoundChanges): string | null {
  if (changes.entersPhase3 && (changes.codebook.changed || changes.prompt.changed)) {
    return CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE
  }
  return changes.codebookAndPrompt ? CODEBOOK_AND_PROMPT_NOTICE : null
}

function phaseNotes(changes: RoundChanges): string[] {
  const notes: string[] = []
  if (changes.entersPhase3) notes.push(ENTERS_PHASE_3_NOTE)
  if (changes.entersPhase4) notes.push(entersPhase4Note(changes.previousRoundNumber))
  return notes
}

function same(version: number): Change {
  return { changed: false, from: version, to: version }
}

function NoticeAlert({ changes }: { changes: RoundChanges }) {
  const notice = noticeOf(changes)
  if (!notice) return null

  return (
    <Alert tone="notice" className="m-0">
      {notice}
    </Alert>
  )
}

function ChangeChip({
  change,
  text,
  help,
}: {
  change: Change
  text: string
  help?: string
}) {
  return (
    <Chip className={change.changed ? 'border-brand! font-semibold text-brand!' : undefined}>
      {text}
      {help ? <InfoTooltip text={help} /> : null}
    </Chip>
  )
}

function helpOf(texts: string[]): string | undefined {
  return texts.length > 0 ? texts.join('\n\n') : undefined
}

export function RoundChangeChips({
  round,
  changes,
  phaseHelp,
  leading,
  trailing,
}: {
  round: ChipRound
  changes: RoundChanges | null
  phaseHelp?: string
  leading?: React.ReactNode
  trailing?: React.ReactNode
}) {
  const codebook = changes?.codebook ?? same(round.codebookVersionNumber)
  const prompt = changes?.prompt ?? same(round.promptVersionNumber)
  const phase = changes?.phase ?? same(round.phase)
  const notes = changes ? phaseNotes(changes) : []
  const phaseChip = (
    <ChangeChip
      change={phase}
      text={phaseChipText(phase)}
      help={helpOf(phaseHelp === undefined ? notes : [phaseHelp, ...notes])}
    />
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {leading}
        {phaseHelp !== undefined ? phaseChip : null}
        <ChangeChip change={codebook} text={codebookChipText(codebook)} />
        <ChangeChip change={prompt} text={promptChipText(prompt)} />
        {phaseHelp === undefined && phase.changed ? phaseChip : null}
        {trailing}
      </div>

      {changes ? <NoticeAlert changes={changes} /> : null}
    </div>
  )
}
