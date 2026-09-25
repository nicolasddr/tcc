import type { Agreement, NotCalculableReason } from '@/lib/agreement'
import { PHASE_3 } from '../../pipeline/preconditions'
import { agreementBand } from './agreement-labels'

export type ReadingGuidance =
  | { kind: 'below_band' }
  | { kind: 'not_calculable'; reason: NotCalculableReason }
  | { kind: 'within_band' }

export function readingGuidance(agreement: Agreement): ReadingGuidance {
  if (!agreement.calculable) return { kind: 'not_calculable', reason: agreement.reason }
  if (agreementBand(agreement.alpha) === 'questionable') return { kind: 'below_band' }
  return { kind: 'within_band' }
}

export function hasReadingGuidance(phase: number): boolean {
  return phase === PHASE_3
}
