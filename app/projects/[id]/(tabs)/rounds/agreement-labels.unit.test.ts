import { describe, it, expect } from 'vitest'
import {
  AGREEMENT_ALL_LABEL,
  AGREEMENT_BANDS,
  ALL_DEFINITIONS_LABEL,
  ALL_DEFINITIONS_LEGEND,
  ALL_DEFINITIONS_NOTE,
  CELL_ALL_DEFINITIONS_PER_RESPONSE_TITLE,
  AGREEMENT_SERIES_POINTS,
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  AGREEMENT_SOURCE,
  BAND_REFERENCE,
  BAND_REFERENCE_LABEL,
  CELL_NOT_APPLICABLE,
  CELL_NOT_APPLICABLE_TITLE,
  CELL_PER_RESPONSE_COLUMN_TITLE,
  CELL_PER_RESPONSE_ROW_TITLE,
  CELL_UNRATED_LABEL,
  CONCENTRATION_HELP,
  MATRIX_PER_RESPONSE_LEGEND,
  OUTLIER_PAIR_POINTS,
  OUTLIER_PAIR_RESULT,
  OUTLIER_PAIR_SUMMARY,
  SMALL_SAMPLE_HELP,
  SMALL_SAMPLE_RATERS,
  SMALL_SAMPLE_RESPONSES,
  agreementBand,
  bandLabel,
  bandTone,
  cellNotCalculableLabel,
  concentrationWarning,
  formatAlpha,
  matrixVersionLabel,
  matrixVersionNote,
  notCalculableMessage,
  profileLine,
  sampleSize,
  smallSampleWarning,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import { PER_RESPONSE_LABEL } from '@/app/projects/[id]/pipeline/criteria'
import * as labels from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import type { Agreement, AgreementProfile } from '@/lib/agreement'

function wordsOf(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

describe('app/projects/[id]/rounds/agreement-labels — o coeficiente na tela', () => {
  it('abaixo do primeiro corte, a faixa é questionável', () => {
    expect(agreementBand(0.666)).toBe('questionable')
    expect(agreementBand(0)).toBe('questionable')
  })

  it('o valor exato do primeiro corte já é aceitável', () => {
    expect(agreementBand(AGREEMENT_BANDS.acceptable)).toBe('acceptable')
    expect(agreementBand(0.799)).toBe('acceptable')
  })

  it('o valor exato do segundo corte já é boa', () => {
    expect(agreementBand(AGREEMENT_BANDS.good)).toBe('good')
    expect(agreementBand(1)).toBe('good')
  })

  it('alpha negativo é discordância acima do acaso, e cai em questionável', () => {
    expect(agreementBand(-1 / 18)).toBe('questionable')
    expect(agreementBand(-1)).toBe('questionable')
  })

  it('a classificação usa o valor cru, não o arredondado da tela', () => {
    expect(formatAlpha(0.66666)).toBe('0,667')
    expect(agreementBand(0.66666)).toBe('questionable')
  })

  it('cada faixa tem rótulo em português e tom de badge próprio', () => {
    expect(bandLabel('questionable')).toBe('Questionável')
    expect(bandLabel('acceptable')).toBe('Aceitável')
    expect(bandLabel('good')).toBe('Boa')

    expect(bandTone('questionable')).toBe('danger')
    expect(bandTone('acceptable')).toBe('warning')
    expect(bandTone('good')).toBe('success')
  })

  it('o número sai com três casas e vírgula, inclusive negativo', () => {
    expect(formatAlpha(1)).toBe('1,000')
    expect(formatAlpha(-1 / 18)).toBe('-0,056')
    expect(formatAlpha(0.8153875)).toBe('0,815')
  })

  it('a frase da faixa cita a origem e diz que não trava nada', () => {
    expect(BAND_REFERENCE).toContain(AGREEMENT_SOURCE)
    expect(BAND_REFERENCE).toContain('0,667')
    expect(BAND_REFERENCE).toContain('0,8')
    expect(BAND_REFERENCE).toContain('não trava')
    expect(wordsOf(BAND_REFERENCE)).toBeLessThanOrEqual(25)
  })

  it('o rótulo curto da faixa é o começo da frase inteira', () => {
    expect(BAND_REFERENCE_LABEL).toBe('Faixa de referência')
    expect(BAND_REFERENCE.startsWith(BAND_REFERENCE_LABEL)).toBe(true)
  })

  it('a linha curta do par diz qual valor é o resultado, e a frase longa continua dizendo o mesmo', () => {
    expect(OUTLIER_PAIR_RESULT).toBe(`O resultado da rodada é o valor ${AGREEMENT_ALL_LABEL}.`)
    expect(OUTLIER_PAIR_SUMMARY).toContain(AGREEMENT_ALL_LABEL)
  })

  it('o ⓘ do par fica com uma frase, e o resto da explicação vira tópicos curtos', () => {
    expect(labels).not.toHaveProperty('OUTLIER_PAIR_HINT')
    expect(wordsOf(OUTLIER_PAIR_SUMMARY)).toBeLessThanOrEqual(25)
    expect(OUTLIER_PAIR_SUMMARY).toContain('saem do mesmo dado desta rodada')

    expect(OUTLIER_PAIR_POINTS.length).toBeGreaterThanOrEqual(1)
    expect(OUTLIER_PAIR_POINTS.length).toBeLessThanOrEqual(3)
    const points = OUTLIER_PAIR_POINTS.join(' ')
    expect(points).toContain(AGREEMENT_WITHOUT_OUTLIERS_LABEL)
    expect(points).toContain('o quanto a exclusão move o número')
    expect(points).toContain('declarada e justificada uma a uma')
    expect(points).toContain('nunca sugerida pela ferramenta')
    expect(points).toContain('nenhuma nota é apagada')
  })

  it('a ajuda da série de Concordância vira até três tópicos, sem perder as fases', () => {
    expect(AGREEMENT_SERIES_POINTS).toHaveLength(3)
    for (const point of AGREEMENT_SERIES_POINTS) {
      expect(wordsOf(point)).toBeLessThanOrEqual(40)
    }

    const [each, twoToThree, threeAndFour] = AGREEMENT_SERIES_POINTS
    expect(each).toContain('a versão de codebook que a rodada fixou e a fase em que ela foi aberta')
    expect(each).toContain('As Fases 2, 3 e 4 ficam na mesma série')
    expect(twoToThree).toContain('com a mesma versão de codebook')
    expect(twoToThree).toContain('a LLM passar a receber o codebook')
    expect(threeAndFour).toContain('concordância maior na rodada seguinte')
    expect(threeAndFour).toContain('Na Fase 4, codebook e prompt não mudam')
    expect(threeAndFour).toContain('os itens e os avaliadores')
    expect(threeAndFour).toContain('ao lado da sua rodada de referência')
  })

  it('o N sai em notas e avaliadores, no singular quando é um só', () => {
    expect(sampleSize({ units: 12, raters: 3 })).toBe('12 notas · 3 avaliadores')
    expect(sampleSize({ units: 1, raters: 1 })).toBe('1 nota · 1 avaliador')
    expect(sampleSize({ units: 0, raters: 0 })).toBe('0 notas · 0 avaliadores')
  })

  it('a amostra pequena avisa por poucos avaliadores ou por poucas respostas', () => {
    expect(
      smallSampleWarning({
        raters: SMALL_SAMPLE_RATERS - 1,
        responses: SMALL_SAMPLE_RESPONSES,
      }),
    ).toContain('Amostra pequena')

    expect(
      smallSampleWarning({
        raters: SMALL_SAMPLE_RATERS,
        responses: SMALL_SAMPLE_RESPONSES - 1,
      }),
    ).toContain('Amostra pequena')
  })

  it('nos dois limites exatos o aviso some', () => {
    expect(
      smallSampleWarning({
        raters: SMALL_SAMPLE_RATERS,
        responses: SMALL_SAMPLE_RESPONSES,
      }),
    ).toBeNull()

    expect(smallSampleWarning({ raters: 8, responses: 40 })).toBeNull()
  })

  it('o aviso de amostra pequena cabe numa linha, com o N de avaliadores e de respostas', () => {
    expect(smallSampleWarning({ raters: 2, responses: 2 })).toBe(
      'Amostra pequena (2 avaliadores, 2 respostas): leia com cautela.',
    )
    expect(smallSampleWarning({ raters: 1, responses: 1 })).toBe(
      'Amostra pequena (1 avaliador, 1 resposta): leia com cautela.',
    )
  })

  it('a ajuda da amostra pequena traz o corte e não se apresenta como literatura', () => {
    expect(SMALL_SAMPLE_HELP).toContain(
      `Abaixo de ${SMALL_SAMPLE_RATERS} avaliadores ou de ${SMALL_SAMPLE_RESPONSES} respostas avaliadas`,
    )
    expect(SMALL_SAMPLE_HELP).toContain('convenção desta ferramenta')
    expect(SMALL_SAMPLE_HELP).toContain('continua valendo')
    expect(SMALL_SAMPLE_HELP).not.toContain(AGREEMENT_SOURCE)
    expect(SMALL_SAMPLE_HELP).toContain('não da literatura')
    expect(wordsOf(SMALL_SAMPLE_HELP)).toBeLessThanOrEqual(25)
  })

  it('cada motivo de não calculável tem o seu texto, e nenhum promete zero ou um', () => {
    const few = notCalculableMessage('few_evaluators')
    const shared = notCalculableMessage('no_shared_units')
    const variation = notCalculableMessage('no_variation')

    expect(few).toContain('pelo menos dois avaliadores')
    expect(few).toContain('ICR')
    expect(shared).toContain('não se cruzaram')
    expect(variation).toContain('mesmo ponto da escala')
    expect(variation).toContain('não é o mesmo que concordância perfeita')

    expect(new Set([few, shared, variation]).size).toBe(3)
  })

  it('o rótulo curto de célula é diferente por motivo, e cabe dentro da célula', () => {
    expect(cellNotCalculableLabel('few_evaluators')).toBe('1 avaliador')
    expect(cellNotCalculableLabel('no_shared_units')).toBe('sem cruzamento')
    expect(cellNotCalculableLabel('no_variation')).toBe('sem variação')

    for (const reason of ['few_evaluators', 'no_shared_units', 'no_variation'] as const) {
      expect(cellNotCalculableLabel(reason).length).toBeLessThan(20)
      expect(cellNotCalculableLabel(reason)).not.toBe(notCalculableMessage(reason))
    }
  })

  it('sem nota e não aplicável são rótulos distintos, e nenhum deles é um número', () => {
    expect(CELL_UNRATED_LABEL).toBe('sem nota')
    expect(CELL_NOT_APPLICABLE).not.toBe(CELL_UNRATED_LABEL)
    expect(CELL_NOT_APPLICABLE).not.toMatch(/\d/)
    expect(CELL_UNRATED_LABEL).not.toMatch(/\d/)
    expect(CELL_NOT_APPLICABLE_TITLE).toContain('outra definição')
  })

  it('o traço da linha por resposta e o da coluna por resposta dizem motivos próprios, explicados no parágrafo', () => {
    expect(CELL_PER_RESPONSE_ROW_TITLE).not.toBe(CELL_NOT_APPLICABLE_TITLE)
    expect(CELL_PER_RESPONSE_COLUMN_TITLE).not.toBe(CELL_NOT_APPLICABLE_TITLE)
    expect(CELL_PER_RESPONSE_ROW_TITLE).not.toBe(CELL_PER_RESPONSE_COLUMN_TITLE)
    expect(MATRIX_PER_RESPONSE_LEGEND).toContain(`“${PER_RESPONSE_LABEL}”`)
    expect(MATRIX_PER_RESPONSE_LEGEND).toContain(`“${CELL_NOT_APPLICABLE}”`)
    expect(MATRIX_PER_RESPONSE_LEGEND).toContain('critérios de definição')
    expect(MATRIX_PER_RESPONSE_LEGEND).toContain('critério por resposta')
  })

  it('a linha de todas as definições diz que é um alpha sobre as notas, e não a média das células', () => {
    expect(ALL_DEFINITIONS_LABEL).toBe('Todas as definições')
    expect(ALL_DEFINITIONS_NOTE).toContain(`“${ALL_DEFINITIONS_LABEL}”`)
    expect(ALL_DEFINITIONS_NOTE).toContain('não a média das células')
    expect(ALL_DEFINITIONS_LEGEND).toContain('que têm o critério')
    expect(ALL_DEFINITIONS_LEGEND).not.toContain('média')
    expect(CELL_ALL_DEFINITIONS_PER_RESPONSE_TITLE).toContain(`linha ${PER_RESPONSE_LABEL}`)
    expect(CELL_ALL_DEFINITIONS_PER_RESPONSE_TITLE).not.toBe(CELL_PER_RESPONSE_COLUMN_TITLE)
  })

  it('a versão da matriz tem rótulo curto e frase inteira, as duas com o número da rodada', () => {
    expect(matrixVersionLabel(4)).toBe('Codebook v4 da rodada')
    expect(matrixVersionNote(4)).toBe(
      'A matriz é da versão de codebook que a rodada fixou, Codebook v4, e não da ' +
        'versão vigente do projeto.',
    )
  })
})

function profile(equal: number, shares: Record<number, number>): AgreementProfile {
  return {
    equal,
    shares: new Map(Object.entries(shares).map(([rank, share]) => [Number(rank), share])),
  }
}

function calculated(alpha: number): Agreement {
  return { calculable: true, alpha, units: 50, raters: 2 }
}

const CONCENTRATED = profile(0.96, { 3: 0.94, 2: 0.06 })

describe('app/projects/[id]/rounds/agreement-labels — notas iguais e distribuição', () => {
  it('a linha do perfil traz as notas iguais e os três níveis na ordem da escala, inclusive 0%', () => {
    expect(profileLine(CONCENTRATED)).toBe(
      '96% de notas iguais · Alto 94% · Médio 6% · Baixo 0%',
    )
  })

  it('a linha do perfil usa uma casa decimal com vírgula', () => {
    expect(profileLine(profile(0.945, { 3: 0.5, 2: 0.255, 1: 0.245 }))).toBe(
      '94,5% de notas iguais · Alto 50% · Médio 25,5% · Baixo 24,5%',
    )
  })

  it('o aviso cita o nível de maior parte e as duas porcentagens', () => {
    expect(concentrationWarning(calculated(-0.01), CONCENTRATED)).toBe(
      'As notas se concentram em Alto (94%), e os avaliadores deram a mesma nota em 96% ' +
        'dos pares. Com pouca variação na escala, poucas divergências bastam para derrubar ' +
        'o α. Leia o número junto com a matriz.',
    )
  })

  it('o nível citado é o de maior parte, mesmo quando não é Alto', () => {
    expect(
      concentrationWarning(calculated(0.2), profile(0.9, { 3: 0.1, 2: 0.85, 1: 0.05 })),
    ).toContain('As notas se concentram em Médio (85%)')
  })

  it('sem aviso quando o α não é calculável', () => {
    expect(
      concentrationWarning(
        { calculable: false, reason: 'no_variation', units: 10, raters: 2 },
        profile(1, { 3: 1 }),
      ),
    ).toBeNull()
  })

  it('sem aviso quando o α está em aceitável ou boa, a partir do corte exato', () => {
    expect(concentrationWarning(calculated(AGREEMENT_BANDS.acceptable), CONCENTRATED)).toBeNull()
    expect(concentrationWarning(calculated(AGREEMENT_BANDS.good), CONCENTRATED)).toBeNull()
    expect(
      concentrationWarning(calculated(AGREEMENT_BANDS.acceptable - 0.001), CONCENTRATED),
    ).not.toBeNull()
  })

  it('o aviso vale a partir de 80% de notas iguais, inclusive', () => {
    expect(concentrationWarning(calculated(0.1), profile(0.8, { 3: 0.9, 2: 0.1 }))).not.toBeNull()
    expect(concentrationWarning(calculated(0.1), profile(0.799, { 3: 0.9, 2: 0.1 }))).toBeNull()
  })

  it('sem perfil não há aviso', () => {
    expect(concentrationWarning(calculated(0.1), null)).toBeNull()
  })

  it('a ajuda do aviso nomeia o paradoxo, os dois cortes e diz que são convenção da ferramenta', () => {
    expect(CONCENTRATION_HELP).toContain('paradoxo da prevalência')
    expect(CONCENTRATION_HELP).toContain('0,667')
    expect(CONCENTRATION_HELP).toContain('80%')
    expect(CONCENTRATION_HELP).toContain('convenção desta ferramenta')
    expect(wordsOf(CONCENTRATION_HELP)).toBeLessThanOrEqual(50)
  })
})
