import { describe, it, expect } from 'vitest'
import {
  EMPTY_PIPELINE,
  PIPELINE_REQUIREMENTS,
  canAdvanceFromPhase1,
  pendingRequirements,
  type PipelineInputKey,
  type PipelineInputs,
} from './preconditions'

const COMPLETE: PipelineInputs = {
  definitions: 1,
  promptText: 'Classifique a intenção da pergunta.',
  items: 1,
}

function keys(inputs: PipelineInputs): PipelineInputKey[] {
  return pendingRequirements(inputs).map((r) => r.key)
}

describe('pendingRequirements', () => {
  it('lista os três insumos quando o pipeline está vazio', () => {
    expect(keys(EMPTY_PIPELINE)).toEqual(['definition', 'prompt', 'item'])
  })

  it('não lista nada quando os três insumos existem', () => {
    expect(keys(COMPLETE)).toEqual([])
  })

  it('lista só a definição quando ela é a única que falta', () => {
    expect(keys({ ...COMPLETE, definitions: 0 })).toEqual(['definition'])
  })

  it('lista só o prompt quando ele é o único que falta', () => {
    expect(keys({ ...COMPLETE, promptText: null })).toEqual(['prompt'])
  })

  it('lista só o item quando ele é o único que falta', () => {
    expect(keys({ ...COMPLETE, items: 0 })).toEqual(['item'])
  })

  it('trata prompt vazio ou só com espaços como faltando', () => {
    expect(keys({ ...COMPLETE, promptText: '' })).toEqual(['prompt'])
    expect(keys({ ...COMPLETE, promptText: '   \n\t ' })).toEqual(['prompt'])
  })

  it('lista os dois que faltam quando só um insumo existe', () => {
    expect(keys({ ...EMPTY_PIPELINE, definitions: 2 })).toEqual(['prompt', 'item'])
    expect(keys({ ...EMPTY_PIPELINE, promptText: 'Um prompt' })).toEqual([
      'definition',
      'item',
    ])
    expect(keys({ ...EMPTY_PIPELINE, items: 3 })).toEqual(['definition', 'prompt'])
  })

  it('nomeia cada pendência e aponta onde ela se resolve', () => {
    for (const req of pendingRequirements(EMPTY_PIPELINE)) {
      expect(req.title.trim()).not.toBe('')
      expect(req.pending.trim()).not.toBe('')
      expect(req.anchor.trim()).not.toBe('')
    }
    expect(PIPELINE_REQUIREMENTS.map((r) => r.anchor)).toEqual([
      'definicoes',
      'prompt',
      'itens',
    ])
  })
})

describe('canAdvanceFromPhase1', () => {
  it('libera o avanço só com os três insumos', () => {
    expect(canAdvanceFromPhase1(COMPLETE)).toBe(true)
  })

  it('bloqueia o avanço em qualquer combinação de falta', () => {
    const combinations: PipelineInputs[] = [
      EMPTY_PIPELINE,
      { ...COMPLETE, definitions: 0 },
      { ...COMPLETE, promptText: null },
      { ...COMPLETE, items: 0 },
      { ...COMPLETE, definitions: 0, promptText: '  ' },
      { ...COMPLETE, definitions: 0, items: 0 },
      { ...COMPLETE, promptText: '', items: 0 },
    ]
    for (const inputs of combinations) {
      expect(canAdvanceFromPhase1(inputs)).toBe(false)
    }
  })
})
