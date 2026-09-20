import { describe, it, expect } from 'vitest'
import {
  EMPTY_PIPELINE,
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PIPELINE_REQUIREMENTS,
  canAdvanceFromPhase1,
  canAdvanceFromPhase2,
  missingInputsList,
  missingInputsMessage,
  pendingRequirements,
  phase2BlockedMessage,
  phase2BlockerMessage,
  phase2Blockers,
  phase3ConfirmationLines,
  wrongPhaseMessage,
  type Phase2Blocker,
  type Phase2Inputs,
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

describe('phase2Blockers', () => {
  function blockerKeys(inputs: Phase2Inputs): Phase2Blocker['key'][] {
    return phase2Blockers(inputs).map((b) => b.key)
  }

  it('bloqueia por rodada fechada quando o projeto não tem rodada nenhuma', () => {
    const inputs: Phase2Inputs = { openRoundNumber: null, closedRounds: 0 }
    expect(blockerKeys(inputs)).toEqual(['no_closed_round'])
    expect(canAdvanceFromPhase2(inputs)).toBe(false)
  })

  it('bloqueia pelos dois, na ordem do gesto, com rodada aberta e nenhuma fechada', () => {
    const inputs: Phase2Inputs = { openRoundNumber: 1, closedRounds: 0 }
    expect(blockerKeys(inputs)).toEqual(['open_round', 'no_closed_round'])
    expect(canAdvanceFromPhase2(inputs)).toBe(false)
  })

  it('bloqueia só pela rodada aberta quando já existe uma fechada', () => {
    const inputs: Phase2Inputs = { openRoundNumber: 2, closedRounds: 1 }
    expect(phase2Blockers(inputs)).toEqual([{ key: 'open_round', roundNumber: 2 }])
    expect(canAdvanceFromPhase2(inputs)).toBe(false)
  })

  it('libera com uma rodada fechada e nenhuma aberta', () => {
    const inputs: Phase2Inputs = { openRoundNumber: null, closedRounds: 1 }
    expect(phase2Blockers(inputs)).toEqual([])
    expect(canAdvanceFromPhase2(inputs)).toBe(true)
  })

  it('libera com várias rodadas fechadas: a pré-condição é ao menos uma', () => {
    const inputs: Phase2Inputs = { openRoundNumber: null, closedRounds: 4 }
    expect(phase2Blockers(inputs)).toEqual([])
    expect(canAdvanceFromPhase2(inputs)).toBe(true)
  })
})

describe('phase2BlockerMessage', () => {
  it('nomeia a rodada aberta e manda fechá-la', () => {
    const message = phase2BlockerMessage({ key: 'open_round', roundNumber: 3 })
    expect(message).toContain('rodada 3')
    expect(message).toContain('aberta')
    expect(message).toContain(`Fase ${PHASE_3}`)
  })

  it('diz que falta fechar uma rodada, e por quê', () => {
    const message = phase2BlockerMessage({ key: 'no_closed_round' })
    expect(message).toContain('Feche ao menos uma rodada')
    expect(message).toContain(`Fase ${PHASE_3}`)
  })
})

describe('phase2BlockedMessage', () => {
  it('não produz mensagem quando o avanço está liberado', () => {
    expect(
      phase2BlockedMessage(phase2Blockers({ openRoundNumber: null, closedRounds: 1 })),
    ).toBe('')
  })

  it('prefixa a recusa e repete a mensagem do primeiro bloqueio', () => {
    const blockers = phase2Blockers({ openRoundNumber: null, closedRounds: 0 })
    const message = phase2BlockedMessage(blockers)
    expect(message).toContain(`Não foi possível avançar para a Fase ${PHASE_3}.`)
    expect(message).toContain(phase2BlockerMessage({ key: 'no_closed_round' }))
  })

  it('oferece o gesto único quando os dois bloqueios estão presentes', () => {
    const message = phase2BlockedMessage(
      phase2Blockers({ openRoundNumber: 1, closedRounds: 0 }),
    )
    expect(message).toContain('rodada 1')
    expect(message).toContain('fechar a rodada aberta resolve as duas pendências')
  })

  it('não oferece o gesto único quando só a rodada aberta bloqueia', () => {
    const message = phase2BlockedMessage(
      phase2Blockers({ openRoundNumber: 2, closedRounds: 1 }),
    )
    expect(message).not.toContain('as duas pendências')
  })
})

describe('wrongPhaseMessage', () => {
  it('nomeia a fase recebida e manda recarregar', () => {
    expect(wrongPhaseMessage(PHASE_3)).toContain(`Fase ${PHASE_3}`)
    expect(wrongPhaseMessage(4)).toContain('Fase 4')
    expect(wrongPhaseMessage(PHASE_3)).toContain('Recarregue a página')
  })
})

describe('phase3ConfirmationLines', () => {
  const lines = phase3ConfirmationLines()
  const text = lines.join(' ')

  it('diz que a decisão é do Administrador e que a métrica não trava', () => {
    expect(text).toContain('A decisão de avançar é do Administrador.')
    expect(text).toContain('Nenhum valor de concordância libera nem impede o avanço')
  })

  it('descreve o que a Fase 3 é no processo, sem prometer tela nova', () => {
    expect(text).toContain(`Na Fase ${PHASE_3}`)
    expect(text).toContain('codebook completo')
  })

  it('avisa que não existe voltar da Fase 3 para a Fase 2', () => {
    expect(text).toContain(`Não existe voltar da Fase ${PHASE_3} para a Fase ${PHASE_2}`)
  })

  it('termina dizendo que cancelar não muda nada', () => {
    expect(lines[lines.length - 1]).toBe('Cancelar não muda nada.')
  })
})

describe('a fase de destino deste avanço', () => {
  it('a validação do codebook é a Fase 2 e o avanço leva à Fase 3', () => {
    expect(PHASE_2).toBe(2)
    expect(PHASE_3).toBe(3)
  })
})
