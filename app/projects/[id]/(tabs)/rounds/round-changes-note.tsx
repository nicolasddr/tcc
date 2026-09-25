import { Alert } from '@/app/components/ui/alert'
import type { Change, RoundChanges } from './round-changes'
import {
  CODEBOOK_AND_PROMPT_NOTICE,
  CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE,
  ENTERS_PHASE_3_NOTE,
  changesHeading,
  codebookChangeText,
  phaseChangeText,
  promptChangeText,
} from './round-changes-labels'

type ChangeLine = { key: string; change: Change; text: string }

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

export function RoundChangesNote({
  changes,
  compact = false,
}: {
  changes: RoundChanges
  compact?: boolean
}) {
  const lines = changeLines(changes)
  const notice = noticeOf(changes)

  return (
    <div className="flex flex-col gap-2">
      {compact ? (
        <p className="m-0 text-[13px] text-muted">
          {lines.map((line, index) => (
            <span key={line.key}>
              {index > 0 ? ' · ' : null}
              <span className={lineClass(line)}>{line.text}</span>
            </span>
          ))}
        </p>
      ) : (
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
      )}

      {changes.entersPhase3 ? (
        <p className="m-0 text-[13px] text-ink">{ENTERS_PHASE_3_NOTE}</p>
      ) : null}

      {notice ? (
        <Alert tone="notice" className="m-0">
          {notice}
        </Alert>
      ) : null}
    </div>
  )
}
