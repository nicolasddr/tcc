import type { Agreement, NotCalculableReason } from '@/lib/agreement'
import { PHASE_3, PHASE_4 } from '../../pipeline/preconditions'
import { agreementBand } from './agreement-labels'

export type GuidedPhase = typeof PHASE_3 | typeof PHASE_4

export type ReadingGuidance = { phase: GuidedPhase } & (
  | { kind: 'below_band' }
  | { kind: 'not_calculable'; reason: NotCalculableReason }
  | { kind: 'within_band' }
)

export function readingGuidance(agreement: Agreement, phase: GuidedPhase): ReadingGuidance {
  if (!agreement.calculable) return { phase, kind: 'not_calculable', reason: agreement.reason }
  if (agreementBand(agreement.alpha) === 'questionable') return { phase, kind: 'below_band' }
  return { phase, kind: 'within_band' }
}

export function hasReadingGuidance(phase: number): phase is GuidedPhase {
  return phase === PHASE_3 || phase === PHASE_4
}
