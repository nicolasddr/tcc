import { describe, it, expect } from 'vitest'
import {
  SCALE,
  isScaleValue,
  scaleLabel,
  scaleTone,
  scaleRank,
} from '@/app/projects/[id]/(tabs)/evaluate/scale'

describe('app/projects/[id]/evaluate/scale — a escala fixa de três pontos', () => {
  it('a escala tem três valores, do maior para o menor', () => {
    expect(SCALE).toEqual(['high', 'medium', 'low'])
  })

  it('reconhece os três valores da escala', () => {
    for (const value of SCALE) expect(isScaleValue(value)).toBe(true)
  })

  it('recusa qualquer coisa que não seja um dos três valores', () => {
    for (const value of ['High', 'alto', 'médio', '', 'muito_alto', null, undefined, 1, {}]) {
      expect(isScaleValue(value)).toBe(false)
    }
  })

  it('traduz para o português na tela', () => {
    expect(scaleLabel('high')).toBe('Alto')
    expect(scaleLabel('medium')).toBe('Médio')
    expect(scaleLabel('low')).toBe('Baixo')
  })

  it('dá um tom distinto a cada valor', () => {
    const tones = SCALE.map(scaleTone)
    expect(tones).toEqual(['success', 'warning', 'danger'])
    expect(new Set(tones).size).toBe(SCALE.length)
  })

  it('vira posto ordinal crescente, de baixo para alto', () => {
    expect(scaleRank('low')).toBe(1)
    expect(scaleRank('medium')).toBe(2)
    expect(scaleRank('high')).toBe(3)
  })

  it('dá um posto distinto a cada valor, e a ordem da escala é decrescente nos postos', () => {
    const ranks = SCALE.map(scaleRank)
    expect(ranks).toEqual([3, 2, 1])
    expect(new Set(ranks).size).toBe(SCALE.length)
  })
})
