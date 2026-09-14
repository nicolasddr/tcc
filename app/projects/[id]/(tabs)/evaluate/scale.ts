export const SCALE = ['high', 'medium', 'low'] as const

export type ScaleValue = (typeof SCALE)[number]

export type ScaleTone = 'success' | 'warning' | 'danger'

export function isScaleValue(value: unknown): value is ScaleValue {
  return typeof value === 'string' && (SCALE as readonly string[]).includes(value)
}

export function scaleLabel(value: ScaleValue): string {
  switch (value) {
    case 'high':
      return 'Alto'
    case 'medium':
      return 'Médio'
    case 'low':
      return 'Baixo'
  }
}

export function scaleTone(value: ScaleValue): ScaleTone {
  switch (value) {
    case 'high':
      return 'success'
    case 'medium':
      return 'warning'
    case 'low':
      return 'danger'
  }
}

