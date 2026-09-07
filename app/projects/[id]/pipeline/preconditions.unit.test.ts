import { describe, it, expect } from 'vitest'
import {
  EMPTY_PIPELINE,
  PHASE_1,
  PHASE_2,
  PIPELINE_REQUIREMENTS,
  canAdvanceFromPhase1,
  missingInputsList,
  missingInputsMessage,
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
      expect(req.route.trim()).not.toBe('')
    }
    expect(PIPELINE_REQUIREMENTS.map((r) => r.route)).toEqual([
      'codebook',
      'prompt',
      'items',
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

describe('missingInputsList', () => {
  it('não lista nada quando não falta insumo', () => {
    expect(missingInputsList(pendingRequirements(COMPLETE))).toBe('')
  })

  it('nomeia o único insumo que falta', () => {
    expect(missingInputsList(pendingRequirements({ ...COMPLETE, definitions: 0 }))).toBe(
      'definição',
    )
    expect(missingInputsList(pendingRequirements({ ...COMPLETE, promptText: '' }))).toBe(
      'texto do prompt',
    )
    expect(missingInputsList(pendingRequirements({ ...COMPLETE, items: 0 }))).toBe(
      'item de entrada',
    )
  })

  it('junta dois insumos com "e"', () => {
    expect(
      missingInputsList(pendingRequirements({ ...COMPLETE, definitions: 0, items: 0 })),
    ).toBe('definição e item de entrada')
  })

  it('junta os três com vírgula e "e" no último', () => {
    expect(missingInputsList(pendingRequirements(EMPTY_PIPELINE))).toBe(
      'definição, texto do prompt e item de entrada',
    )
  })
})

describe('missingInputsMessage', () => {
  it('não produz mensagem quando o avanço está liberado', () => {
    expect(missingInputsMessage(pendingRequirements(COMPLETE))).toBe('')
  })

  it('nomeia cada insumo que falta, em cada combinação de falta', () => {
    const combinations: PipelineInputs[] = [
      EMPTY_PIPELINE,
      { ...COMPLETE, definitions: 0 },
      { ...COMPLETE, promptText: null },
      { ...COMPLETE, items: 0 },
      { ...COMPLETE, definitions: 0, items: 0 },
      { ...COMPLETE, promptText: '  ', items: 0 },
    ]

    for (const inputs of combinations) {
      const pending = pendingRequirements(inputs)
      const message = missingInputsMessage(pending)
      for (const req of pending) {
        expect(message).toContain(req.title.toLocaleLowerCase('pt-BR'))
      }
      for (const req of PIPELINE_REQUIREMENTS.filter((r) => !pending.includes(r))) {
        expect(message).not.toContain(req.title.toLocaleLowerCase('pt-BR'))
      }
    }
  })

  it('diz o que fazer, em português e sem código técnico', () => {
    const message = missingInputsMessage(pendingRequirements(EMPTY_PIPELINE))
    expect(message).toContain('Fase 2')
    expect(message).toContain('Cadastre o que falta')
  })
})

describe('as fases que esta trava conhece', () => {
  it('a configuração é a Fase 1 e o avanço leva à Fase 2', () => {
    expect(PHASE_1).toBe(1)
    expect(PHASE_2).toBe(2)
  })
})
