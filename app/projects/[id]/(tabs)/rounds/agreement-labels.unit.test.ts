import { describe, it, expect } from 'vitest'
import {
  AGREEMENT_BANDS,
  AGREEMENT_SOURCE,
  BAND_REFERENCE,
  SMALL_SAMPLE_RATERS,
  SMALL_SAMPLE_RESPONSES,
  agreementBand,
  bandLabel,
  bandTone,
  formatAlpha,
  notCalculableMessage,
  sampleSize,
  smallSampleWarning,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'

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
    expect(bandLabel('questionable')).toBe('questionável')
    expect(bandLabel('acceptable')).toBe('aceitável')
    expect(bandLabel('good')).toBe('boa')

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
  })

  it('o N sai em unidades e avaliadores, no singular quando é um só', () => {
    expect(sampleSize({ units: 12, raters: 3 })).toBe('12 unidades · 3 avaliadores')
    expect(sampleSize({ units: 1, raters: 1 })).toBe('1 unidade · 1 avaliador')
    expect(sampleSize({ units: 0, raters: 0 })).toBe('0 unidades · 0 avaliadores')
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

  it('o aviso de amostra pequena não se apresenta como literatura', () => {
    const warning = smallSampleWarning({ raters: 2, responses: 4 })!

    expect(warning).toContain('convenção desta ferramenta')
    expect(warning).not.toContain(AGREEMENT_SOURCE)
  })

  it('cada motivo de não calculável tem o seu texto, e nenhum promete zero ou um', () => {
    const few = notCalculableMessage('few_evaluators')
    const shared = notCalculableMessage('no_shared_units')
    const variation = notCalculableMessage('no_variation')

    expect(few).toContain('Menos de dois avaliadores')
    expect(shared).toContain('não se cruzaram')
    expect(variation).toContain('mesmo ponto da escala')
    expect(variation).toContain('não é o mesmo que concordância perfeita')

    expect(new Set([few, shared, variation]).size).toBe(3)
  })
})
