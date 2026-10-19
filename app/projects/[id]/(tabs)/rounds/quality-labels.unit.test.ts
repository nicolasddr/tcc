import { describe, it, expect } from 'vitest'
import * as labels from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import {
  QUALITY_CRITERION_LEGEND,
  QUALITY_HINT,
  QUALITY_MATRIX_LEGEND,
  QUALITY_POINTS,
  QUALITY_SERIES_HINT,
  QUALITY_SERIES_NOTE,
  QUALITY_SERIES_POINTS,
  formatShare,
  levelShares,
  levelText,
  levelsText,
  qualityTotal,
} from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  CELL_NOT_APPLICABLE,
  CELL_NOT_APPLICABLE_TITLE,
  CELL_UNRATED_LABEL,
  BY_DEFINITION_LABEL,
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
  return Object.values(labels).flatMap((value) => {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.filter((item) => typeof item === 'string')
    return []
  })
}

function wordsOf(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
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
        QUALITY_CRITERION_LEGEND,
        QUALITY_MATRIX_LEGEND,
        QUALITY_SERIES_HINT,
        ...QUALITY_SERIES_POINTS,
        QUALITY_SERIES_NOTE,
        ...QUALITY_POINTS,
      ]),
    )
  })

  it('uma linha da distribuição traz o ponto da escala, a porcentagem e a contagem', () => {
    expect(levelText({ value: 'high', count: 5, share: 0.625 })).toBe('Alto 62,5% (5)')
    expect(levelText({ value: 'low', count: 0, share: 0 })).toBe('Baixo 0% (0)')
  })

  it('a distribuição inteira junta as três linhas, e a versão curta traz só os percentuais na ordem da escala', () => {
    const levels = [
      { value: 'high' as const, count: 5, share: 0.625 },
      { value: 'medium' as const, count: 2, share: 0.25 },
      { value: 'low' as const, count: 1, share: 0.125 },
    ]

    expect(levelsText(levels)).toBe('Alto 62,5% (5) · Médio 25% (2) · Baixo 12,5% (1)')
    expect(levelShares(levels)).toBe('62,5 · 25 · 12,5')
  })

  it('a legenda da matriz explica a barra e os percentuais, e diz onde está a contagem', () => {
    expect(QUALITY_MATRIX_LEGEND).not.toContain('contagem ao lado')
    expect(QUALITY_MATRIX_LEGEND).toContain('Alto · Médio · Baixo')
    expect(QUALITY_MATRIX_LEGEND).toContain('ao passar o mouse na célula')
  })

  it('a legenda da matriz usa as mesmas expressões da matriz de ICR e diz que sem nota não é 0%', () => {
    expect(QUALITY_MATRIX_LEGEND).toContain(`“${CELL_UNRATED_LABEL}”`)
    expect(QUALITY_MATRIX_LEGEND).toContain(`“${CELL_NOT_APPLICABLE}”`)
    expect(QUALITY_MATRIX_LEGEND).toContain(CELL_NOT_APPLICABLE_TITLE)
    expect(QUALITY_MATRIX_LEGEND).toContain('não vale 0%')
  })

  it('a legenda da tabela por critério diz que as definições se juntam numa soma, e não numa média, e onde está a matriz', () => {
    expect(QUALITY_CRITERION_LEGEND).toBe(
      'Na tabela por critério, cada linha junta as notas do critério em todas as definições ' +
        'que o têm; o critério por resposta traz as notas dele. As contagens são a soma das ' +
        'células da coluna na matriz, e as porcentagens saem desse total, e não da média das ' +
        `células. A matriz por definição fica em ${BY_DEFINITION_LABEL}.`,
    )
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
      ...QUALITY_SERIES_POINTS,
      QUALITY_SERIES_NOTE,
    ]) {
      expect(text).not.toMatch(/ICR|Krippendorff|concordância|faixa|confiáve|compar/i)
    }
    const series = QUALITY_SERIES_POINTS.join(' ')
    expect(series).toContain('Fase 3')
    expect(series).toContain('Fase 2 não entram')
    expect(series).toContain('Nenhum valor junta rodadas')
  })

  it('as explicações longas viram tópicos curtos de "Saiba mais", e não um ⓘ', () => {
    expect(labels).not.toHaveProperty('QUALITY_HELP')
    expect(labels).not.toHaveProperty('QUALITY_SERIES_HELP')

    for (const points of [QUALITY_POINTS, QUALITY_SERIES_POINTS]) {
      expect(points.length).toBeGreaterThanOrEqual(1)
      expect(points.length).toBeLessThanOrEqual(3)
      for (const point of points) {
        expect(wordsOf(point)).toBeLessThanOrEqual(40)
      }
    }

    const series = QUALITY_SERIES_POINTS.join(' ')
    expect(series).toContain('versões de codebook e de prompt')
    expect(series).toContain('nada é somado nem tirado a média')
    expect(series).toContain(`depois do ${AGREEMENT_ALL_LABEL}`)
    expect(series).toContain('ao lado da sua rodada de referência, na tela de rodadas')

    const quality = QUALITY_POINTS.join(' ')
    expect(quality).toContain('podem não somar 100%')
    expect(quality).toContain('não fixa um alvo')
    expect(quality).toContain('quem conhece a tarefa é quem lê o número')
  })

  it('a explicação diz o que o número é, sem orientar a leitura pelo ICR nem por faixa', () => {
    expect(QUALITY_HINT).toContain('Alto, Médio e Baixo')
    const quality = QUALITY_POINTS.join(' ')
    expect(quality).toContain('quando ele é por resposta')
    expect(quality).toContain('não o de respostas')
    expect(quality).toContain('a contagem vem ao lado')
    expect(quality.toLowerCase()).not.toContain(QUALITY_HINT.slice(0, -1).toLowerCase())
    expect(quality).not.toMatch(/ICR|Krippendorff|concordância|faixa|confiáve/i)
  })
})
