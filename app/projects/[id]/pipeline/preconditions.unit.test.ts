import { describe, it, expect } from 'vitest'
import {
  EMPTY_PIPELINE,
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
  PIPELINE_REQUIREMENTS,
  canAdvanceFromPhase1,
  canAdvanceFromPhase2,
  canAdvanceFromPhase3,
  missingInputsList,
  missingInputsMessage,
  pendingRequirements,
  phase2BlockedMessage,
  phase2BlockerMessage,
  phase2Blockers,
  phase3BlockedMessage,
  phase3BlockerMessage,
  phase3Blockers,
  phase3ConfirmationLines,
  phase4ConfirmationLines,
  wrongPhaseMessage,
  type Phase2Blocker,
  type Phase2Inputs,
  type Phase3Blocker,
  type Phase3Inputs,
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

describe('phase3Blockers — o avanço da Fase 3 para a Fase 4', () => {
  function blockerKeys(inputs: Phase3Inputs): Phase3Blocker['key'][] {
    return phase3Blockers(inputs).map((b) => b.key)
  }

  it('bloqueia por rodada fechada quando não há rodada nenhuma na Fase 3', () => {
    const inputs: Phase3Inputs = { openRoundNumber: null, closedRounds: 0, versions: null }
    expect(blockerKeys(inputs)).toEqual(['no_closed_round'])
    expect(canAdvanceFromPhase3(inputs)).toBe(false)
  })

  it('bloqueia pelos dois, na ordem do gesto, com rodada aberta e nenhuma fechada', () => {
    const inputs: Phase3Inputs = { openRoundNumber: 4, closedRounds: 0, versions: null }
    expect(blockerKeys(inputs)).toEqual(['open_round', 'no_closed_round'])
    expect(canAdvanceFromPhase3(inputs)).toBe(false)
  })

  it('bloqueia só pela rodada aberta quando já existe uma fechada', () => {
    const inputs: Phase3Inputs = { openRoundNumber: 5, closedRounds: 1, versions: null }
    expect(phase3Blockers(inputs)).toEqual([{ key: 'open_round', roundNumber: 5 }])
    expect(canAdvanceFromPhase3(inputs)).toBe(false)
  })

  it('libera com uma ou várias rodadas fechadas e nenhuma aberta', () => {
    for (const closedRounds of [1, 3]) {
      const inputs: Phase3Inputs = { openRoundNumber: null, closedRounds, versions: null }
      expect(phase3Blockers(inputs)).toEqual([])
      expect(canAdvanceFromPhase3(inputs)).toBe(true)
    }
  })

  it('segue a mesma regra da Fase 2 para as mesmas entradas', () => {
    const cases: Phase3Inputs[] = [
      { openRoundNumber: null, closedRounds: 0, versions: null },
      { openRoundNumber: 1, closedRounds: 0, versions: null },
      { openRoundNumber: 2, closedRounds: 1, versions: null },
      { openRoundNumber: null, closedRounds: 1, versions: null },
      { openRoundNumber: null, closedRounds: 4, versions: null },
    ]
    for (const inputs of cases) {
      expect(phase3Blockers(inputs)).toEqual(phase2Blockers(inputs))
    }
  })
})

describe('phase3Blockers — as versões da rodada de referência', () => {
  function withVersions(
    current: { codebook: number; prompt: number },
    openRoundNumber: number | null = null,
  ): Phase3Inputs {
    return {
      openRoundNumber,
      closedRounds: 1,
      versions: { referenceRound: 2, reference: { codebook: 1, prompt: 1 }, current },
    }
  }

  it.each([
    {
      caso: 'codebook mudou',
      current: { codebook: 2, prompt: 1 },
      changes: [{ subject: 'codebook', reference: 1, current: 2 }],
    },
    {
      caso: 'prompt mudou',
      current: { codebook: 1, prompt: 3 },
      changes: [{ subject: 'prompt', reference: 1, current: 3 }],
    },
    {
      caso: 'os dois mudaram',
      current: { codebook: 2, prompt: 3 },
      changes: [
        { subject: 'codebook', reference: 1, current: 2 },
        { subject: 'prompt', reference: 1, current: 3 },
      ],
    },
  ])('bloqueia quando o $caso', ({ current, changes }) => {
    const inputs = withVersions(current)
    expect(phase3Blockers(inputs)).toEqual([
      { key: 'versions_changed', referenceRound: 2, changes },
    ])
    expect(canAdvanceFromPhase3(inputs)).toBe(false)
  })

  it('libera quando as versões vigentes são as da rodada de referência', () => {
    const inputs = withVersions({ codebook: 1, prompt: 1 })
    expect(phase3Blockers(inputs)).toEqual([])
    expect(canAdvanceFromPhase3(inputs)).toBe(true)
  })

  it('não aplica a regra sem rodada de referência', () => {
    const inputs: Phase3Inputs = { openRoundNumber: null, closedRounds: 1, versions: null }
    expect(phase3Blockers(inputs)).toEqual([])
    expect(canAdvanceFromPhase3(inputs)).toBe(true)
  })

  it('põe as versões depois da rodada aberta', () => {
    const inputs = withVersions({ codebook: 2, prompt: 1 }, 3)
    expect(phase3Blockers(inputs).map((b) => b.key)).toEqual(['open_round', 'versions_changed'])
  })
})

describe('phase3BlockerMessage e phase3BlockedMessage', () => {
  it('nomeia a rodada aberta e manda fechá-la', () => {
    const message = phase3BlockerMessage({ key: 'open_round', roundNumber: 6 })
    expect(message).toContain('rodada 6')
    expect(message).toContain('aberta')
    expect(message).toContain(`Fase ${PHASE_4}`)
  })

  it('pede rodada fechada da Fase 3 e diz que as da Fase 2 não contam', () => {
    const message = phase3BlockerMessage({ key: 'no_closed_round' })
    expect(message).toContain(`rodada da Fase ${PHASE_3}`)
    expect(message).toContain(`As rodadas da Fase ${PHASE_2} não contam.`)
  })

  it('não produz mensagem quando o avanço está liberado', () => {
    expect(
      phase3BlockedMessage(
        phase3Blockers({ openRoundNumber: null, closedRounds: 1, versions: null }),
      ),
    ).toBe('')
  })

  it('prefixa a recusa com a Fase 4 e repete a mensagem de cada bloqueio', () => {
    const blockers: Phase3Blocker[][] = [
      [{ key: 'open_round', roundNumber: 2 }],
      [{ key: 'no_closed_round' }],
    ]
    for (const single of blockers) {
      const message = phase3BlockedMessage(single)
      expect(message.startsWith(`Não foi possível avançar para a Fase ${PHASE_4}.`)).toBe(
        true,
      )
      expect(message).toContain(phase3BlockerMessage(single[0]))
      expect(message).not.toContain('as duas pendências')
    }
  })

  it.each([
    {
      caso: 'codebook',
      changes: [{ subject: 'codebook' as const, reference: 1, current: 2 }],
      numbers: ['versão 1', 'vigente é a 2'],
    },
    {
      caso: 'prompt',
      changes: [{ subject: 'prompt' as const, reference: 2, current: 4 }],
      numbers: ['versão 2', 'vigente é a 4'],
    },
    {
      caso: 'codebook e o prompt',
      changes: [
        { subject: 'codebook' as const, reference: 1, current: 2 },
        { subject: 'prompt' as const, reference: 3, current: 5 },
      ],
      numbers: [
        'codebook na versão 1',
        'prompt na versão 3',
        'codebook na versão 2',
        'prompt na versão 5',
      ],
    },
  ])('nomeia o que mudou ($caso), com os números, e manda abrir e fechar uma rodada', ({
    caso,
    changes,
    numbers,
  }) => {
    const message = phase3BlockerMessage({ key: 'versions_changed', referenceRound: 4, changes })
    expect(message).toContain(`O ${caso}`)
    expect(message).toContain('rodada 4')
    for (const number of numbers) expect(message).toContain(number)
    expect(message.toLocaleLowerCase('pt-BR')).toContain(
      `abra e feche mais uma rodada da fase ${PHASE_3}`,
    )
    expect(message).not.toMatch(/ICR|Qualidade|concordância|\bvoltar\b/i)
  })

  it('recusa por versões sem o gesto único, sozinha ou depois da rodada aberta', () => {
    const versions: Phase3Blocker = {
      key: 'versions_changed',
      referenceRound: 2,
      changes: [{ subject: 'codebook', reference: 1, current: 2 }],
    }

    const alone = phase3BlockedMessage([versions])
    expect(alone).toBe(
      `Não foi possível avançar para a Fase ${PHASE_4}. ${phase3BlockerMessage(versions)}`,
    )

    const withOpen = phase3BlockedMessage([{ key: 'open_round', roundNumber: 3 }, versions])
    expect(withOpen).toBe(
      `Não foi possível avançar para a Fase ${PHASE_4}. ` +
        phase3BlockerMessage({ key: 'open_round', roundNumber: 3 }),
    )
    expect(withOpen).not.toContain('as duas pendências')
  })

  it('oferece o gesto único quando os dois bloqueios estão presentes', () => {
    const message = phase3BlockedMessage(
      phase3Blockers({ openRoundNumber: 3, closedRounds: 0, versions: null }),
    )
    expect(message).toContain('rodada 3')
    expect(message).toContain('fechar a rodada aberta resolve as duas pendências')
  })
})

describe('phase4ConfirmationLines', () => {
  const lines = phase4ConfirmationLines()
  const text = lines.join(' ')

  it('descreve o que a Fase 4 é e que ela congela codebook e prompt', () => {
    expect(text).toContain(`Na Fase ${PHASE_4}`)
    expect(text).toContain('codebook e prompt congelados enquanto ela durar')
    expect(text).toContain(`A Fase ${PHASE_3} continua visível como está`)
  })

  it('diz que a decisão é do Administrador e que nem ICR nem Qualidade travam', () => {
    expect(text).toContain('A decisão de avançar é do Administrador.')
    expect(text).toContain('Nenhum valor de concordância ou de Qualidade libera nem impede o avanço')
    expect(text).toContain('ICR')
  })

  it('termina dizendo que cancelar não muda nada', () => {
    expect(lines[lines.length - 1]).toBe('Cancelar não muda nada.')
  })

  it('não fala em retorno', () => {
    for (const line of lines) {
      expect(line).not.toMatch(/\b(voltar|volta|retorno|retornar)\b/i)
    }
  })
})

describe('a fase de destino do avanço da Fase 3', () => {
  it('o avanço da Fase 3 leva à Fase 4', () => {
    expect(PHASE_4).toBe(4)
  })
})
