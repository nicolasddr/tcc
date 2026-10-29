import type { ScaleValue } from '@/app/projects/[id]/(tabs)/evaluate/scale'

export type Round8Rater = 'ana' | 'bruno'

export const ROUND_8_RESPONSES = 10

export const ROUND_8_QUERIES = ['Query 1', 'Query 2', 'Query 3', 'Query 4', 'Query 5'] as const

export const ROUND_8_SHAPE = {
  definitions: ROUND_8_QUERIES.map((title) => ({ title, type: 'category' as const })),
  generalCriteria: [{ name: 'Relevance' }],
  perResponseCriteria: [{ name: 'Diversity' }],
}

export const ROUND_8_ALPHA = {
  relevance: '-0,031',
  diversity: '0,548',
  pooled: '0,811',
} as const

export function round8Relevance(
  rater: Round8Rater,
  response: number,
  query: number,
): ScaleValue {
  return rater === 'bruno' && query === 0 && response < 4 ? 'medium' : 'high'
}

export function round8Diversity(rater: Round8Rater, response: number): ScaleValue {
  if (response < 6) return 'medium'
  if (response < 8) return 'low'
  return rater === 'ana' ? 'medium' : 'low'
}
