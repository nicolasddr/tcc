import { describe, it, expect } from 'vitest'
import * as labels from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import {
  QUALITY_HELP,
  formatShare,
  qualityTotal,
} from '@/app/projects/[id]/(tabs)/rounds/quality-labels'

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

  it('a explicação diz o que o número é, sem orientar a leitura pelo ICR nem por faixa', () => {
    expect(QUALITY_HELP).toContain('Alto, Médio e Baixo')
    expect(QUALITY_HELP).toContain('não o de respostas')
    expect(QUALITY_HELP).not.toMatch(/ICR|Krippendorff|concordância|faixa|confiáve/i)
  })
})
