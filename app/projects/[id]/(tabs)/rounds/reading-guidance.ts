import type { Agreement, NotCalculableReason } from '@/lib/agreement'
import { PHASE_3, PHASE_4 } from '../../pipeline/preconditions'
import { agreementBand } from './agreement-labels'

export type GuidedPhase = typeof PHASE_3 | typeof PHASE_4

export type GuidanceCriterion = { name: string; agreement: Agreement; concentrated: boolean }

export type ReadingGuidance = { phase: GuidedPhase } & (
  | { kind: 'below_band'; criterion: string; concentrated: boolean }
  | { kind: 'not_calculable'; criterion: string | null; reason: NotCalculableReason }
  | { kind: 'within_band' }
)

export function readingGuidance(
  weakest: GuidanceCriterion | null,
  phase: GuidedPhase,
): ReadingGuidance {
  if (!weakest) {
    return { phase, kind: 'not_calculable', criterion: null, reason: 'few_evaluators' }
  }

  const { name, agreement, concentrated } = weakest
  if (!agreement.calculable) {
    return { phase, kind: 'not_calculable', criterion: name, reason: agreement.reason }
  }
  if (agreementBand(agreement.alpha) === 'questionable') {
    return { phase, kind: 'below_band', criterion: name, concentrated }
  }
  return { phase, kind: 'within_band' }
}

export const QUALITY_SECTION_ID = 'qualidade'

export type GuidanceShortcutKind = 'quality' | 'codebook'

export type GuidanceShortcut = { kind: GuidanceShortcutKind; href: string }

export function guidanceShortcut(
  guidance: ReadingGuidance,
  projectId: string,
): GuidanceShortcut | null {
  if (guidance.phase !== PHASE_3) return null
  switch (guidance.kind) {
    case 'within_band':
      return { kind: 'quality', href: `#${QUALITY_SECTION_ID}` }
    case 'below_band':
      return { kind: 'codebook', href: `/projects/${projectId}/codebook` }
    case 'not_calculable':
      return null
  }
}

export function hasReadingGuidance(phase: number): phase is GuidedPhase {
  return phase === PHASE_3 || phase === PHASE_4
}
