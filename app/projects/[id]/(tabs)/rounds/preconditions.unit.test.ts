import { describe, it, expect } from 'vitest'
import {
  canGenerate,
  canOpenRound,
  ceilingReachedMessage,
  closeConfirmationLines,
  evaluatorsNotFinished,
  pendingEvaluatorsTitle,
  openRoundSummary,
  codebookLockedMessage,
  phase4RoundLockedMessage,
  generationMax,
  responsesLeftMessage,
  retryLabel,
  roundBlockerMessage,
  roundBlockerSummary,
  roundInputSummary,
  roundBlockers,
  roundLockedMessage,
  selectionBlockerMessage,
  selectionBlockers,
  SELECTION_MAX,
  type RoundBlocker,
  type RoundInputs,
  type SelectionInputs,
} from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import {
  versionChangesSentence,
  type VersionChange,
  type VersionCheck,
} from '@/app/projects/[id]/(tabs)/rounds/reference-round'
import {
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
} from '@/app/projects/[id]/pipeline/preconditions'
import { SCALE, scaleLabel } from '@/app/projects/[id]/(tabs)/evaluate/scale'

function inputs(patch: Partial<RoundInputs> = {}): RoundInputs {
  return {
    phase: PHASE_2,
    definitions: [{ id: 'd1', title: 'Informacional' }],
    criteria: [{ definitionId: 'd1' }],
    hasPromptVersion: true,
    openRoundNumber: null,
    versions: null,
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
    const lines = closeConfirmationLines(2, PHASE_3)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('Fechar a rodada 2 é irreversível')
    expect(lines[0]).toContain('não existe reabrir')
    expect(lines[1]).toContain('codebook volta a ser editável')
    expect(lines[2]).toContain('não espera quem ainda não terminou')
    expect(lines.every((line) => line.length <= 120)).toBe(true)
  })

  it('a confirmação não repete os nomes de quem não terminou no corpo do texto', () => {
    expect(closeConfirmationLines(1, PHASE_3).join(' ')).not.toContain('Ainda não terminaram')
  })

  it('o título dos pendentes conta os avaliadores, em vez de listá-los no texto', () => {
    expect(pendingEvaluatorsTitle(1, 2)).toBe('1 avaliador ainda não terminou:')
    expect(pendingEvaluatorsTitle(3, 3)).toBe('3 avaliadores ainda não terminaram:')
  })

  it('sem nenhum avaliador ativo, o título diz isso em vez de anunciar lista vazia', () => {
    expect(pendingEvaluatorsTitle(0, 0)).toBe('Nenhum avaliador ativo no projeto.')
  })

  it('com todos os ativos terminados, o título diz isso em vez de anunciar lista vazia', () => {
    expect(pendingEvaluatorsTitle(0, 2)).toBe('Todos os avaliadores ativos terminaram.')
  })

  it('terminou quem avaliou todas as respostas da rodada, e só avaliador ativo conta', () => {
    const evaluators = [
      { name: 'Ana', status: 'active', submitted: 2 },
      { name: 'Bruno', status: 'active', submitted: 1 },
      { name: 'Caio', status: 'active', submitted: 0 },
      { name: 'Duda', status: 'inactive', submitted: 0 },
    ]
    expect(evaluatorsNotFinished(evaluators, 2)).toEqual(['Bruno', 'Caio'])
  })

  it('rodada sem resposta não deixa ninguém terminado por vacuidade', () => {
    const evaluators = [
      { name: 'Ana', status: 'active', submitted: 0 },
      { name: 'Duda', status: 'inactive', submitted: 0 },
    ]
    expect(evaluatorsNotFinished(evaluators, 0)).toEqual(['Ana'])
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

  it('na Fase 4, a trava da rodada aberta diz que o congelamento é da fase e não promete destravar', () => {
    const message = phase4RoundLockedMessage(2)
    expect(message).toContain('rodada 2')
    expect(message).toContain(`Na Fase ${PHASE_4}`)
    expect(message).toContain('congelados pela fase')
    expect(message).not.toContain('Feche a rodada para voltar a editar')
  })

  it('a trava da rodada aberta escolhe a mensagem pela fase da rodada', () => {
    expect(roundLockedMessage(2, PHASE_2)).toBe(codebookLockedMessage(2))
    expect(roundLockedMessage(2, PHASE_3)).toBe(codebookLockedMessage(2))
    expect(roundLockedMessage(2, PHASE_4)).toBe(phase4RoundLockedMessage(2))
  })

  it('na Fase 4, a confirmação de fechamento não diz que o codebook volta a ser editável', () => {
    const lines = closeConfirmationLines(2, PHASE_4)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe(closeConfirmationLines(2, PHASE_3)[0])
    expect(lines[1]).toContain(`congelados pela Fase ${PHASE_4}`)
    expect(lines[2]).toBe(closeConfirmationLines(2, PHASE_3)[2])
    expect(lines.join(' ')).not.toContain('volta a ser editável')
    expect(lines.every((line) => line.length <= 120)).toBe(true)
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

  it('a partir da Fase 3 a frase é a do codebook completo, com a fase da rodada', () => {
    const summary = roundInputSummary(PHASE_4)
    expect(summary).toContain(`Fase ${PHASE_4}`)
    expect(summary).toContain('codebook completo')
    expect(summary).not.toContain(`Fase ${PHASE_3}`)
    expect(summary.replace(`Fase ${PHASE_4}`, `Fase ${PHASE_3}`)).toBe(roundInputSummary(PHASE_3))
  })

  it('nenhuma das frases fala da escala', () => {
    for (const phase of [PHASE_2, PHASE_3, PHASE_4]) {
      const summary = roundInputSummary(phase)
      for (const value of SCALE) {
        expect(summary).not.toContain(scaleLabel(value))
      }
    }
  })
})

function versions(current: { codebook: number; prompt: number }): VersionCheck {
  return { referenceRound: 3, reference: { codebook: 2, prompt: 5 }, current }
}

const ALL_BLOCKERS: RoundBlocker[] = [
  { key: 'phase', phase: PHASE_1 },
  { key: 'open_round', roundNumber: 2 },
  { key: 'definition' },
  { key: 'criteria', titles: ['Informacional'] },
  { key: 'prompt' },
  { key: 'no_reference_round' },
  {
    key: 'versions_changed',
    referenceRound: 3,
    changes: [{ subject: 'codebook', reference: 2, current: 4 }],
  },
]

describe('app/projects/[id]/rounds/preconditions — rodada na Fase 4', () => {
  it('libera a abertura com o codebook e o prompt da rodada de referência', () => {
    const input = inputs({ phase: PHASE_4, versions: versions({ codebook: 2, prompt: 5 }) })
    expect(roundBlockers(input)).toEqual([])
    expect(canOpenRound(input)).toBe(true)
  })

  it.each<[string, { codebook: number; prompt: number }, VersionChange[]]>([
    ['o codebook', { codebook: 4, prompt: 5 }, [{ subject: 'codebook', reference: 2, current: 4 }]],
    ['o prompt', { codebook: 2, prompt: 6 }, [{ subject: 'prompt', reference: 5, current: 6 }]],
    [
      'o codebook e o prompt',
      { codebook: 4, prompt: 6 },
      [
        { subject: 'codebook', reference: 2, current: 4 },
        { subject: 'prompt', reference: 5, current: 6 },
      ],
    ],
  ])('trava quando %s mudou depois da rodada de referência', (_, current, changes) => {
    const input = inputs({ phase: PHASE_4, versions: versions(current) })
    expect(roundBlockers(input)).toEqual([
      { key: 'versions_changed', referenceRound: 3, changes },
    ])
    expect(canOpenRound(input)).toBe(false)
  })

  it('trava sem rodada de referência, mesmo com codebook completo e prompt', () => {
    const input = inputs({ phase: PHASE_4, versions: null })
    expect(roundBlockers(input)).toEqual([{ key: 'no_reference_round' }])
    expect(canOpenRound(input)).toBe(false)
  })

  it('sem referência e sem prompt, acusa só o prompt', () => {
    const input = inputs({ phase: PHASE_4, versions: null, hasPromptVersion: false })
    expect(keys(input)).toEqual(['prompt'])
  })

  it('com rodada aberta e versões diferentes, a rodada aberta vem primeiro', () => {
    const input = inputs({
      phase: PHASE_4,
      openRoundNumber: 4,
      versions: versions({ codebook: 4, prompt: 5 }),
    })
    expect(keys(input)).toEqual(['open_round', 'versions_changed'])
  })

  it('as Fases 2 e 3 ignoram as versões da rodada de referência', () => {
    for (const phase of [PHASE_2, PHASE_3]) {
      for (const versionCheck of [null, versions({ codebook: 4, prompt: 6 })]) {
        const input = inputs({ phase, versions: versionCheck })
        expect(roundBlockers(input)).toEqual([])
        expect(canOpenRound(input)).toBe(true)
      }
    }
  })

  it.each<[VersionChange[], string, number[]]>([
    [[{ subject: 'codebook', reference: 2, current: 4 }], 'O codebook mudou', [2, 4]],
    [[{ subject: 'prompt', reference: 5, current: 6 }], 'O prompt mudou', [5, 6]],
    [
      [
        { subject: 'codebook', reference: 2, current: 4 },
        { subject: 'prompt', reference: 5, current: 6 },
      ],
      'O codebook e o prompt mudaram',
      [2, 4, 5, 6],
    ],
  ])('o resumo e a mensagem de versões mudadas nomeiam %j', (changes, subject, numbers) => {
    const blocker = { key: 'versions_changed', referenceRound: 3, changes } as const

    expect(roundBlockerSummary(blocker)).toBe(
      `${subject} depois da rodada de referência, a rodada 3.`,
    )

    const message = roundBlockerMessage(blocker)
    expect(message.startsWith(versionChangesSentence(3, changes))).toBe(true)
    expect(message).toContain('a rodada 3')
    for (const number of numbers) expect(message).toMatch(new RegExp(`\\b${number}\\b`))
    expect(message).toContain(`volte à Fase ${PHASE_3}`)
  })

  it('o resumo e a mensagem sem rodada de referência mandam voltar à Fase 3', () => {
    const blocker = { key: 'no_reference_round' } as const
    expect(roundBlockerSummary(blocker)).toContain(`Fase ${PHASE_3}`)
    expect(roundBlockerMessage(blocker)).toMatch(new RegExp(`volte à Fase ${PHASE_3}`, 'i'))
  })

  it('as mensagens da Fase 4 não falam de concordância nem de Qualidade', () => {
    const phase4 = ALL_BLOCKERS.filter(
      (blocker) => blocker.key === 'no_reference_round' || blocker.key === 'versions_changed',
    )
    for (const blocker of phase4) {
      for (const text of [roundBlockerSummary(blocker), roundBlockerMessage(blocker)]) {
        expect(text).not.toContain('ICR')
        expect(text).not.toContain('Qualidade')
        expect(text).not.toContain('concordância')
      }
    }
  })

  it('nenhum bloqueio diz que uma fase ainda não está disponível', () => {
    for (const blocker of ALL_BLOCKERS) {
      expect(roundBlockerSummary(blocker)).not.toContain('ainda não está disponível')
      expect(roundBlockerMessage(blocker)).not.toContain('ainda não está disponível')
    }
  })
})
