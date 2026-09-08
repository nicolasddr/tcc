import { describe, it, expect } from 'vitest'
import {
  canOpenRound,
  closeConfirmationLines,
  codebookLockedMessage,
  roundBlockerMessage,
  roundBlockers,
  type RoundInputs,
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
