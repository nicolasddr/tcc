import { describe, it, expect } from 'vitest'
import {
  canGenerate,
  canOpenRound,
  closeConfirmationLines,
  codebookLockedMessage,
  roundBlockerMessage,
  roundBlockers,
  selectionBlockerMessage,
  selectionBlockers,
  SELECTION_MAX,
  type RoundInputs,
  type SelectionInputs,
} from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { PHASE_1, PHASE_2 } from '@/app/projects/[id]/pipeline/preconditions'

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

  it('a confirmação de fechamento diz que é irreversível e nomeia quem não terminou', () => {
    const lines = closeConfirmationLines(2, ['Ana', 'Bia']).join(' ')
    expect(lines).toContain('Fechar a rodada 2 é irreversível')
    expect(lines).toContain('não existe reabrir')
    expect(lines).toContain('Fechar não depende de todos terem terminado')
    expect(lines).toContain('Ainda não terminaram: Ana, Bia.')
    expect(lines).toContain('destrava a edição do codebook')
  })

  it('a confirmação sem nenhum avaliador ativo diz isso em vez de deixar a lista vazia', () => {
    const lines = closeConfirmationLines(1, []).join(' ')
    expect(lines).toContain('nenhum avaliador ativo')
    expect(lines).not.toContain('Ainda não terminaram')
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
})
