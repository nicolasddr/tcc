import { describe, it, expect } from 'vitest'
import {
  canGenerate,
  canOpenRound,
  ceilingReachedMessage,
  closeConfirmationLines,
  pendingEvaluatorsTitle,
  openRoundSummary,
  codebookLockedMessage,
  generationMax,
  responsesLeftMessage,
  retryLabel,
  roundBlockerMessage,
  roundInputSummary,
  roundBlockers,
  selectionBlockerMessage,
  selectionBlockers,
  SELECTION_MAX,
  type RoundInputs,
  type SelectionInputs,
} from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { PHASE_1, PHASE_2, PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'
import { SCALE, scaleLabel } from '@/app/projects/[id]/(tabs)/evaluate/scale'

function inputs(patch: Partial<RoundInputs> = {}): RoundInputs {
  return {
    phase: PHASE_2,
    definitions: [{ id: 'd1', title: 'Informacional' }],
    criteria: [{ definitionId: 'd1' }],
    hasPromptVersion: true,
    openRoundNumber: null,
    ...patch,
  }
}

function keys(input: RoundInputs): string[] {
  return roundBlockers(input).map((blocker) => blocker.key)
}

describe('app/projects/[id]/rounds/preconditions — o que trava a abertura de uma rodada', () => {
  it('libera a abertura com uma definição, um critério e um prompt', () => {
    expect(roundBlockers(inputs())).toEqual([])
    expect(canOpenRound(inputs())).toBe(true)
  })

  it('trava na Fase 1, porque rodada só existe a partir da Fase 2', () => {
    const input = inputs({ phase: PHASE_1 })
    expect(keys(input)).toContain('phase')
    expect(canOpenRound(input)).toBe(false)
    expect(roundBlockerMessage({ key: 'phase', phase: PHASE_1 })).toContain(
      `Fase ${PHASE_2}`,
    )
  })

  it('trava enquanto houver uma rodada aberta, e a mensagem diz qual é', () => {
    const input = inputs({ openRoundNumber: 3 })
    expect(keys(input)).toContain('open_round')
    expect(roundBlockerMessage({ key: 'open_round', roundNumber: 3 })).toContain(
      'rodada 3',
    )
  })

  it('trava sem nenhuma definição', () => {
    const input = inputs({ definitions: [], criteria: [] })
    expect(keys(input)).toEqual(['definition'])
    expect(canOpenRound(input)).toBe(false)
  })

  it('trava quando uma definição está sem critério, e a mensagem nomeia essa definição', () => {
    const input = inputs({
      definitions: [
        { id: 'd1', title: 'Informacional' },
        { id: 'd2', title: 'Transacional' },
      ],
      criteria: [{ definitionId: 'd1' }],
    })

    const [blocker] = roundBlockers(input)
    expect(blocker).toEqual({ key: 'criteria', titles: ['Transacional'] })

    const message = roundBlockerMessage(blocker)
    expect(message).toContain('“Transacional”')
    expect(message).not.toContain('“Informacional”')
  })

  it('nomeia todas as definições sem critério quando há mais de uma', () => {
    const input = inputs({
      definitions: [
        { id: 'd1', title: 'Informacional' },
        { id: 'd2', title: 'Transacional' },
        { id: 'd3', title: 'Navegacional' },
      ],
      criteria: [{ definitionId: 'd2' }],
    })

    const [blocker] = roundBlockers(input)
    expect(blocker).toEqual({
      key: 'criteria',
      titles: ['Informacional', 'Navegacional'],
    })
    expect(roundBlockerMessage(blocker)).toContain('“Informacional” e “Navegacional”')
  })

  it('um critério geral cobre todas as definições e libera a abertura', () => {
    const input = inputs({
      definitions: [
        { id: 'd1', title: 'Informacional' },
        { id: 'd2', title: 'Transacional' },
      ],
      criteria: [{ definitionId: null }],
    })
    expect(roundBlockers(input)).toEqual([])
  })

  it('trava sem versão de prompt para congelar', () => {
    const input = inputs({ hasPromptVersion: false })
    expect(keys(input)).toEqual(['prompt'])
  })

  it('acumula tudo o que falta, em vez de parar no primeiro problema', () => {
    const input = inputs({
      phase: PHASE_1,
      definitions: [],
      criteria: [],
      hasPromptVersion: false,
    })
    expect(keys(input)).toEqual(['phase', 'definition', 'prompt'])
  })

  it('a confirmação de fechamento cabe em poucas linhas curtas', () => {
    const lines = closeConfirmationLines(2)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('Fechar a rodada 2 é irreversível')
    expect(lines[0]).toContain('não existe reabrir')
    expect(lines[1]).toContain('codebook volta a ser editável')
    expect(lines[2]).toContain('não espera quem ainda não terminou')
    expect(lines.every((line) => line.length <= 120)).toBe(true)
  })

  it('a confirmação não repete os nomes de quem não terminou no corpo do texto', () => {
    expect(closeConfirmationLines(1).join(' ')).not.toContain('Ainda não terminaram')
  })

  it('o título dos pendentes conta os avaliadores, em vez de listá-los no texto', () => {
    expect(pendingEvaluatorsTitle(1)).toBe('1 avaliador ainda não terminou:')
    expect(pendingEvaluatorsTitle(3)).toBe('3 avaliadores ainda não terminaram:')
  })

  it('sem nenhum avaliador ativo, o título diz isso em vez de anunciar lista vazia', () => {
    expect(pendingEvaluatorsTitle(0)).toBe('Nenhum avaliador ativo no projeto.')
  })

  it('o resumo da rodada aberta nomeia as versões congeladas', () => {
    expect(openRoundSummary(2, 3, 4)).toBe(
      'A rodada 2 está aberta sobre o codebook v3 e o prompt v4.',
    )
  })

  it('a mensagem da trava do codebook nomeia a rodada aberta e diz como destravar', () => {
    const message = codebookLockedMessage(2)
    expect(message).toContain('rodada 2')
    expect(message).toContain('leitura')
    expect(message).toContain('Feche a rodada')
  })
})

const POOL = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']

function selection(patch: Partial<SelectionInputs> = {}): SelectionInputs {
  return { available: POOL, usedInRound: [], ...patch }
}

function selectionKeys(
  selected: readonly string[],
  inputs: SelectionInputs = selection(),
): string[] {
  return selectionBlockers(selected, inputs).map((blocker) => blocker.key)
}

describe('app/projects/[id]/rounds/preconditions — o que trava a seleção de itens da geração', () => {
  it('libera de 1 até o máximo de itens do pool', () => {
    expect(selectionBlockers(['i1'], selection())).toEqual([])
    expect(canGenerate(POOL.slice(0, SELECTION_MAX), selection())).toBe(true)
  })

  it('trava sem nenhum item selecionado, porque não haveria resposta a gerar', () => {
    expect(selectionKeys([])).toEqual(['empty'])
    expect(canGenerate([], selection())).toBe(false)
    expect(selectionBlockerMessage({ key: 'empty' })).toContain(`1 a ${SELECTION_MAX}`)
  })

  it('trava acima do máximo, e a mensagem diz o teto e quantos vieram', () => {
    const selected = POOL.slice(0, SELECTION_MAX + 1)
    expect(selectionKeys(selected)).toEqual(['too_many'])

    const [blocker] = selectionBlockers(selected, selection())
    expect(blocker).toEqual({ key: 'too_many', count: 6, max: SELECTION_MAX })

    const message = selectionBlockerMessage(blocker)
    expect(message).toContain(`máximo ${SELECTION_MAX}`)
    expect(message).toContain('vieram 6')
  })

  it('trava o mesmo item repetido na seleção, porque um item é uma resposta só', () => {
    expect(selectionKeys(['i1', 'i2', 'i1'])).toEqual(['repeated'])
    expect(selectionBlockerMessage({ key: 'repeated' })).toContain('duas vezes')
  })

  it('trava item que não é do projeto', () => {
    expect(selectionKeys(['i1', 'de-outro-projeto'])).toEqual(['foreign'])
    expect(selectionBlockerMessage({ key: 'foreign' })).toContain('não é deste projeto')
  })

  it('trava item que já produziu resposta nesta rodada, e conta quantos são', () => {
    const inputs = selection({ usedInRound: ['i2', 'i3'] })
    expect(selectionKeys(['i1', 'i2'], inputs)).toEqual(['already_used'])

    const [blocker] = selectionBlockers(['i1', 'i2', 'i3'], inputs)
    expect(blocker).toEqual({ key: 'already_used', count: 2 })
    expect(selectionBlockerMessage(blocker)).toContain('2 dos itens')
    expect(selectionBlockerMessage({ key: 'already_used', count: 1 })).toContain(
      'Um dos itens',
    )
  })

  it('o mesmo item volta a ser selecionável quando o uso é de outra rodada', () => {
    expect(selectionBlockers(['i1'], selection({ usedInRound: [] }))).toEqual([])
  })

  it('acumula tudo o que trava, em vez de parar no primeiro problema', () => {
    const inputs = selection({ usedInRound: ['i2'] })
    expect(selectionKeys(['i1', 'i1', 'i2', 'i3', 'i4', 'x'], inputs)).toEqual([
      'too_many',
      'repeated',
      'foreign',
      'already_used',
    ])
  })

  it('trava a seleção acima das vagas restantes, que é outra causa que o lote cheio', () => {
    const inputs = selection({ responsesLeft: 2 })
    expect(selectionKeys(['i1', 'i2'], inputs)).toEqual([])
    expect(selectionKeys(['i1', 'i2', 'i3'], inputs)).toEqual(['ceiling'])

    const [blocker] = selectionBlockers(['i1', 'i2', 'i3'], inputs)
    expect(blocker).toEqual({ key: 'ceiling', count: 3, left: 2 })

    const message = selectionBlockerMessage(blocker)
    expect(message).toContain('Restam 2 vagas')
    expect(message).toContain('vieram 3')
  })

  it('sem nenhuma vaga restante, a mensagem fala do teto em vez de mandar tirar itens', () => {
    expect(selectionKeys(['i1'], selection({ responsesLeft: 0 }))).toEqual(['ceiling'])
    expect(selectionBlockerMessage({ key: 'ceiling', count: 1, left: 0 })).toContain(
      'não tem mais nenhuma vaga',
    )
  })

  it('o lote cheio e as vagas restantes travam por conta própria, cada um com sua causa', () => {
    expect(selectionKeys(POOL, selection({ responsesLeft: 3 }))).toEqual([
      'too_many',
      'ceiling',
    ])
  })
})

describe('app/projects/[id]/rounds/preconditions — o teto do projeto no seletor', () => {
  it('o máximo da geração nasce limitado pelas vagas restantes', () => {
    expect(generationMax(200)).toBe(SELECTION_MAX)
    expect(generationMax(SELECTION_MAX)).toBe(SELECTION_MAX)
    expect(generationMax(2)).toBe(2)
    expect(generationMax(0)).toBe(0)
    expect(generationMax(-1)).toBe(0)
  })

  it('a tela diz quantas vagas restam, de quantas', () => {
    expect(responsesLeftMessage(7, 200)).toBe(
      'Restam 7 vagas de resposta de LLM neste projeto, de 200.',
    )
    expect(responsesLeftMessage(1, 200)).toBe(
      'Resta 1 vaga de resposta de LLM neste projeto, de 200.',
    )
    expect(responsesLeftMessage(0, 200)).toContain('Restam 0 vagas')
  })

  it('o teto atingido nomeia o limite', () => {
    expect(ceilingReachedMessage(200)).toContain('teto de 200 respostas')
  })

  it('a retentativa nomeia quantos itens ela vai selecionar', () => {
    expect(retryLabel(1)).toBe('Tentar de novo só este item')
    expect(retryLabel(3)).toBe('Tentar de novo só estes 3 itens')
  })
})

describe('app/projects/[id]/rounds/preconditions — o que a rodada manda à LLM', () => {
  it('a rodada da Fase 2 fala em títulos, e não em descrição nem critério', () => {
    const summary = roundInputSummary(PHASE_2)
    expect(summary).toContain(`Fase ${PHASE_2}`)
    expect(summary).toContain('títulos das definições')
    expect(summary).not.toContain('descrição')
    expect(summary).not.toContain('critério')
    expect(summary).not.toContain('codebook')
  })

  it('a rodada da Fase 3 fala em codebook completo, descrição e critérios', () => {
    const summary = roundInputSummary(PHASE_3)
    expect(summary).toContain(`Fase ${PHASE_3}`)
    expect(summary).toContain('codebook completo')
    expect(summary).toContain('descrição')
    expect(summary).toContain('critérios gerais')
  })

  it('a partir da Fase 3 a frase é a da Fase 3', () => {
    expect(roundInputSummary(4)).toBe(roundInputSummary(PHASE_3))
  })

  it('nenhuma das frases fala da escala', () => {
    for (const phase of [PHASE_2, PHASE_3]) {
      const summary = roundInputSummary(phase)
      for (const value of SCALE) {
        expect(summary).not.toContain(scaleLabel(value))
      }
    }
  })
})
