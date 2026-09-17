import { describe, it, expect } from 'vitest'
import {
  DIVERGENCE_LEGEND,
  NO_JUSTIFICATION_HINT,
  NO_JUSTIFICATION_LABEL,
  classifyDivergence,
  divergenceLabel,
  divergenceMeaning,
  divergenceTone,
  isDivergent,
  type CellDivergence,
} from '@/app/projects/[id]/(tabs)/rounds/divergence'
import { SCALE } from '@/app/projects/[id]/(tabs)/evaluate/scale'

const STATES: CellDivergence[] = [
  'unrated',
  'single',
  'unanimous',
  'adjacent',
  'extreme',
]

describe('app/projects/[id]/rounds/divergence — a divergência de uma célula', () => {
  it('sem nota nenhuma a célula fica sem nota, e não unânime', () => {
    expect(classifyDivergence([])).toBe('unrated')
  })

  it('uma nota só é estado próprio: não é unanimidade nem divergência', () => {
    expect(classifyDivergence(['medium'])).toBe('single')
    expect(isDivergent('single')).toBe(false)
    expect(divergenceLabel('single')).not.toBe(divergenceLabel('unanimous'))
  })

  it('duas notas no mesmo ponto da escala são unanimidade', () => {
    expect(classifyDivergence(['high', 'high'])).toBe('unanimous')
    expect(classifyDivergence(['low', 'low', 'low'])).toBe('unanimous')
  })

  it('pontos vizinhos da escala dão divergência adjacente', () => {
    expect(classifyDivergence(['high', 'medium'])).toBe('adjacent')
    expect(classifyDivergence(['medium', 'low'])).toBe('adjacent')
  })

  it('os dois extremos da escala na mesma célula dão divergência extrema', () => {
    expect(classifyDivergence(['high', 'low'])).toBe('extreme')
  })

  it('três notas distintas na mesma célula são extremas, e não adjacentes', () => {
    expect(classifyDivergence(['high', 'medium', 'low'])).toBe('extreme')
  })

  it('a ordem em que as notas chegam não muda a classificação', () => {
    expect(classifyDivergence(['low', 'high'])).toBe(classifyDivergence(['high', 'low']))
    expect(classifyDivergence(['medium', 'low', 'high'])).toBe(
      classifyDivergence(['high', 'medium', 'low']),
    )
  })

  it('repetir uma nota não desfaz a divergência: o que conta é a distância', () => {
    expect(classifyDivergence(['high', 'high', 'medium'])).toBe('adjacent')
    expect(classifyDivergence(['high', 'high', 'low'])).toBe('extreme')
  })

  it('só adjacente e extrema são divergência', () => {
    expect(STATES.filter(isDivergent)).toEqual(['adjacent', 'extreme'])
  })

  it('cada estado tem rótulo próprio em português e tom de badge', () => {
    expect(divergenceLabel('unrated')).toBe('sem nota')
    expect(divergenceLabel('single')).toBe('1 nota')
    expect(divergenceLabel('unanimous')).toBe('unânime')
    expect(divergenceLabel('adjacent')).toBe('divergência adjacente')
    expect(divergenceLabel('extreme')).toBe('divergência extrema')

    expect(STATES.map(divergenceTone)).toEqual([
      'neutral',
      'neutral',
      'success',
      'warning',
      'danger',
    ])
  })

  it('sem nota e uma nota são neutros: nenhum dos dois se parece com unanimidade', () => {
    expect(divergenceTone('unrated')).toBe(divergenceTone('single'))
    expect(divergenceTone('single')).not.toBe(divergenceTone('unanimous'))
  })

  it('cada estado explica por extenso o que significa', () => {
    for (const state of STATES) {
      expect(divergenceMeaning(state).length).toBeGreaterThan(0)
    }
    expect(new Set(STATES.map(divergenceMeaning)).size).toBe(STATES.length)
  })

  it('a legenda distingue adjacente de extrema e cita a escala inteira', () => {
    expect(DIVERGENCE_LEGEND).toContain(divergenceLabel('adjacent'))
    expect(DIVERGENCE_LEGEND).toContain(divergenceLabel('extreme'))
    expect(DIVERGENCE_LEGEND).toContain('fronteira borrada')
    expect(DIVERGENCE_LEGEND).toContain('ambígua')
    expect(DIVERGENCE_LEGEND).toContain(divergenceLabel('single'))
  })

  it('a ausência de justificativa é dita por extenso, e não é falha de carregamento', () => {
    expect(NO_JUSTIFICATION_LABEL).toBe('sem justificativa')
    expect(NO_JUSTIFICATION_HINT).toContain(NO_JUSTIFICATION_LABEL)
    expect(NO_JUSTIFICATION_HINT).toContain('opcional')
  })

  it('a classificação cobre a escala inteira, sem ponto sem estado', () => {
    for (const value of SCALE) {
      expect(classifyDivergence([value])).toBe('single')
      expect(classifyDivergence([value, value])).toBe('unanimous')
    }
  })
})
