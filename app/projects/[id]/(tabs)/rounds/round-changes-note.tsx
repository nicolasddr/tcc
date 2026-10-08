import { Alert } from '@/app/components/ui/alert'
import { Chip } from '@/app/components/ui/chip'
import { InfoTooltip } from '@/app/components/ui/tooltip'
import type { Change, RoundChanges } from './round-changes'
import {
  CODEBOOK_AND_PROMPT_NOTICE,
  CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE,
  ENTERS_PHASE_3_NOTE,
  changesHeading,
  codebookChangeText,
  codebookChipText,
  entersPhase4Note,
  phaseChangeText,
  phaseChipText,
  promptChangeText,
  promptChipText,
} from './round-changes-labels'

type ChangeLine = { key: string; change: Change; text: string }

type Versions = { codebookVersionNumber: number; promptVersionNumber: number }

function changeLines(changes: RoundChanges): ChangeLine[] {
  return [
    {
      key: 'codebook',
      change: changes.codebook,
      text: codebookChangeText(changes.codebook),
    },
    { key: 'prompt', change: changes.prompt, text: promptChangeText(changes.prompt) },
    { key: 'phase', change: changes.phase, text: phaseChangeText(changes.phase) },
  ]
}

function noticeOf(changes: RoundChanges): string | null {
  if (changes.entersPhase3 && (changes.codebook.changed || changes.prompt.changed)) {
    return CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE
  }
  return changes.codebookAndPrompt ? CODEBOOK_AND_PROMPT_NOTICE : null
}

function lineClass(line: ChangeLine): string | undefined {
  return line.change.changed ? 'text-ink' : undefined
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

export function RoundChangeChips({
  round,
  changes,
}: {
  round: Versions
  changes: RoundChanges | null
}) {
  const codebook = changes?.codebook ?? same(round.codebookVersionNumber)
  const prompt = changes?.prompt ?? same(round.promptVersionNumber)
  const notes = changes ? phaseNotes(changes) : []

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <ChangeChip change={codebook} text={codebookChipText(codebook)} />
        <ChangeChip change={prompt} text={promptChipText(prompt)} />
        {changes?.phase.changed ? (
          <ChangeChip
            change={changes.phase}
            text={phaseChipText(changes.phase)}
            help={notes.length > 0 ? notes.join('\n\n') : undefined}
          />
        ) : null}
      </div>

      {changes ? <NoticeAlert changes={changes} /> : null}
    </div>
  )
}

export function RoundChangesNote({ changes }: { changes: RoundChanges }) {
  const lines = changeLines(changes)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[13px] font-semibold text-ink">
          {changesHeading(changes.previousRoundNumber)}
        </p>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[13px] text-muted">
          {lines.map((line) => (
            <li key={line.key} className={lineClass(line)}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>

      {changes.entersPhase3 ? (
        <p className="m-0 text-[13px] text-ink">{ENTERS_PHASE_3_NOTE}</p>
      ) : null}

      {changes.entersPhase4 ? (
        <p className="m-0 text-[13px] text-ink">
          {entersPhase4Note(changes.previousRoundNumber)}
        </p>
      ) : null}

      <NoticeAlert changes={changes} />
    </div>
  )
}
