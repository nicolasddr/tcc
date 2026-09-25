import { describe, it, expect } from 'vitest'
import * as labels from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import {
  QUALITY_HELP,
  QUALITY_MATRIX_LEGEND,
  QUALITY_SERIES_HELP,
  QUALITY_SERIES_HINT,
  QUALITY_SERIES_NOTE,
  QUALITY_SERIES_NOTE_SINGLE,
  formatShare,
  levelText,
  qualityTotal,
} from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  CELL_NOT_APPLICABLE,
  CELL_NOT_APPLICABLE_TITLE,
  CELL_UNRATED_LABEL,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'

const JUDGEMENT_WORDS = [
  'boa',
  'bom',
  'ruim',
  'aprovad',
  'reprovad',
  'meta',
  'atinge',
  'suficiente',
  'adequad',
]

function exportedStrings(): string[] {
  return Object.values(labels).filter(
    (value): value is string => typeof value === 'string',
  )
}

describe('app/projects/[id]/rounds/quality-labels — a Qualidade na tela', () => {
  it('a porcentagem sai em pt-BR com no máximo uma casa decimal', () => {
    expect(formatShare(0.625)).toBe('62,5%')
    expect(formatShare(1)).toBe('100%')
    expect(formatShare(0)).toBe('0%')
    expect(formatShare(1 / 3)).toBe('33,3%')
  })

  it('o total conta notas, no singular e no plural', () => {
    expect(qualityTotal(1)).toBe('1 nota')
    expect(qualityTotal(8)).toBe('8 notas')
  })

  it('nenhuma palavra exportada julga a distribuição', () => {
    const strings = exportedStrings()

    expect(strings.length).toBeGreaterThan(0)
    for (const text of strings) {
      for (const word of JUDGEMENT_WORDS) {
        expect(text.toLowerCase()).not.toContain(word)
      }
    }
  })

  it('a varredura de palavras de juízo alcança as frases da matriz e da série', () => {
    expect(exportedStrings()).toEqual(
      expect.arrayContaining([
        QUALITY_MATRIX_LEGEND,
        QUALITY_SERIES_HINT,
        QUALITY_SERIES_HELP,
        QUALITY_SERIES_NOTE,
        QUALITY_SERIES_NOTE_SINGLE,
      ]),
    )
  })

  it('uma linha da distribuição traz o ponto da escala, a porcentagem e a contagem', () => {
    expect(levelText({ value: 'high', count: 5, share: 0.625 })).toBe('Alto 62,5% (5)')
    expect(levelText({ value: 'low', count: 0, share: 0 })).toBe('Baixo 0% (0)')
  })

  it('a legenda da matriz usa as mesmas expressões da matriz de ICR e diz que sem nota não é 0%', () => {
    expect(QUALITY_MATRIX_LEGEND).toContain(`“${CELL_UNRATED_LABEL}”`)
    expect(QUALITY_MATRIX_LEGEND).toContain(`“${CELL_NOT_APPLICABLE}”`)
    expect(QUALITY_MATRIX_LEGEND).toContain(CELL_NOT_APPLICABLE_TITLE)
    expect(QUALITY_MATRIX_LEGEND).toContain('não vale 0%')
  })

  it('a legenda da matriz diz que o par vem com todos primeiro', () => {
    const all = QUALITY_MATRIX_LEGEND.indexOf(AGREEMENT_ALL_LABEL)
    const without = QUALITY_MATRIX_LEGEND.indexOf(AGREEMENT_WITHOUT_OUTLIERS_LABEL)

    expect(all).toBeGreaterThanOrEqual(0)
    expect(without).toBeGreaterThan(all)
  })

  it('as frases da série não falam de ICR, de faixa nem comparam fases', () => {
    for (const text of [
      QUALITY_SERIES_HINT,
      QUALITY_SERIES_HELP,
      QUALITY_SERIES_NOTE,
      QUALITY_SERIES_NOTE_SINGLE,
    ]) {
      expect(text).not.toMatch(/ICR|Krippendorff|concordância|faixa|confiáve|compar/i)
    }
    expect(QUALITY_SERIES_HELP).toContain('Fase 3')
    expect(QUALITY_SERIES_HELP).toContain('Fase 2 não entram')
    expect(QUALITY_SERIES_HELP).toContain('Nenhum valor junta rodadas')
  })

  it('a explicação diz o que o número é, sem orientar a leitura pelo ICR nem por faixa', () => {
    expect(QUALITY_HELP).toContain('Alto, Médio e Baixo')
    expect(QUALITY_HELP).toContain('não o de respostas')
    expect(QUALITY_HELP).not.toMatch(/ICR|Krippendorff|concordância|faixa|confiáve/i)
  })
})
