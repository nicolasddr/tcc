import { describe, it, expect } from 'vitest'
import {
  composeLlmInput,
  CODEBOOK_HEADING,
  DEFINITION_PREFIX,
  DEFINITIONS_HEADING,
  GENERAL_CRITERIA_HEADING,
  ITEM_HEADING,
  OWN_CRITERIA_HEADING,
  type LlmCriterion,
  type LlmDefinition,
  type LlmInputParts,
} from './llm-input'
import { PHASE_1, PHASE_2, PHASE_3 } from './preconditions'
import { DEFINITION_TYPE_OPTIONS, definitionTypeLabel } from '@/app/projects/definition-types'
import { SCALE, scaleLabel } from '../(tabs)/evaluate/scale'

const DEFINITIONS: (LlmDefinition & { type: string })[] = [
  {
    id: 'nav',
    title: 'Navegacional',
    description: 'A pessoa quer chegar a um site específico.',
    type: 'category',
  },
  { id: 'inf', title: 'Informacional', description: null, type: 'quality_dimension' },
  {
    id: 'tra',
    title: 'Transacional',
    description: 'A pessoa quer concluir uma ação.',
    type: 'guideline',
  },
]

const CRITERIA: LlmCriterion[] = [
  { definitionId: 'nav', name: 'Cita o destino', description: 'a consulta nomeia o site' },
  { definitionId: 'inf', name: 'Pede explicação', description: null },
  { definitionId: null, name: 'Uma intenção só', description: 'a consulta tem um objetivo' },
]

const PARTS: LlmInputParts = {
  phase: PHASE_2,
  promptText: 'Classifique a consulta de busca abaixo.',
  definitions: DEFINITIONS,
  criteria: CRITERIA,
  itemContent: 'como fazer bolo de cenoura',
}

const PHASE_2_INPUT = [
  'Classifique a consulta de busca abaixo.',
  '',
  'Definições:',
  '- Navegacional',
  '- Informacional',
  '- Transacional',
  '',
  'Item de entrada:',
  'como fazer bolo de cenoura',
].join('\n')

const PHASE_3_PARTS: LlmInputParts = { ...PARTS, phase: PHASE_3 }

const PHASE_3_INPUT = [
  'Classifique a consulta de busca abaixo.',
  '',
  'Codebook:',
  '',
  'Definição: Navegacional',
  'A pessoa quer chegar a um site específico.',
  'Critérios:',
  '- Cita o destino: a consulta nomeia o site',
  '',
  'Definição: Informacional',
  'Critérios:',
  '- Pede explicação',
  '',
  'Definição: Transacional',
  'A pessoa quer concluir uma ação.',
  '',
  'Critérios gerais, que valem para todas as definições:',
  '- Uma intenção só: a consulta tem um objetivo',
  '',
  'Item de entrada:',
  'como fazer bolo de cenoura',
].join('\n')

function occurrences(text: string, fragment: string): number {
  return text.split(fragment).length - 1
}

describe('composeLlmInput', () => {
  it('na Fase 2, compõe exatamente o texto de hoje, byte a byte', () => {
    expect(composeLlmInput(PARTS)).toBe(PHASE_2_INPUT)
  })

  it('na Fase 1, compõe como na Fase 2', () => {
    expect(composeLlmInput({ ...PARTS, phase: PHASE_1 })).toBe(PHASE_2_INPUT)
  })

  it('envia o prompt, os títulos das definições e o conteúdo do item, nessa ordem', () => {
    const input = composeLlmInput(PARTS)
    expect(input.indexOf(PARTS.promptText)).toBe(0)
    expect(input.indexOf(DEFINITIONS_HEADING)).toBeGreaterThan(0)
    expect(input.indexOf(ITEM_HEADING)).toBeGreaterThan(input.indexOf(DEFINITIONS_HEADING))
    expect(input.indexOf(PARTS.itemContent)).toBeGreaterThan(input.indexOf(ITEM_HEADING))
  })

  it('preserva a ordem salva das definições', () => {
    const input = composeLlmInput(PARTS)
    const positions = PARTS.definitions.map((definition) => input.indexOf(definition.title))
    expect(positions.every((position) => position > 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)

    const reversed = composeLlmInput({
      ...PARTS,
      definitions: [...PARTS.definitions].reverse(),
    })
    expect(reversed.indexOf('Transacional')).toBeLessThan(reversed.indexOf('Navegacional'))
  })

  it('na Fase 2, leva só os títulos: nenhuma descrição e nenhum critério entram no envio', () => {
    const input = composeLlmInput(PARTS)
    for (const definition of DEFINITIONS) {
      if (definition.description) expect(input).not.toContain(definition.description)
    }
    for (const criterion of CRITERIA) {
      expect(input).not.toContain(criterion.name)
      if (criterion.description) expect(input).not.toContain(criterion.description)
    }
    const lines = input.split('\n').filter((line) => line.startsWith('- '))
    expect(lines).toEqual(['- Navegacional', '- Informacional', '- Transacional'])
  })

  it('preserva a formatação do prompt e a do item, sem normalizar', () => {
    const promptText = 'Primeira linha\n\n   linha recuada\n\tlinha com tabulação'
    const itemContent = 'linha 1\n\n\nlinha 4   com espaços no fim   '
    const input = composeLlmInput({ ...PARTS, promptText, itemContent })
    expect(input).toContain(promptText)
    expect(input).toContain(itemContent)
  })

  it('compõe o envio mesmo com uma definição só', () => {
    const input = composeLlmInput({ ...PARTS, definitions: [DEFINITIONS[0]] })
    expect(input).toContain(`${DEFINITIONS_HEADING}\n- Navegacional`)
  })
})

describe('composeLlmInput na Fase 3', () => {
  it('envia o prompt, o codebook completo e o item, no formato fixado', () => {
    expect(composeLlmInput(PHASE_3_PARTS)).toBe(PHASE_3_INPUT)
  })

  it('com fase 4, compõe como na Fase 3', () => {
    expect(composeLlmInput({ ...PARTS, phase: 4 })).toBe(PHASE_3_INPUT)
  })

  it('não leva o bloco de títulos da Fase 2', () => {
    expect(composeLlmInput(PHASE_3_PARTS)).not.toContain(DEFINITIONS_HEADING)
  })

  it('mantém a ordem recebida de definições e critérios, com os gerais depois da última definição e o item por último', () => {
    const criteria: LlmCriterion[] = [
      { definitionId: 'nav', name: 'Segundo', description: 'vem depois' },
      { definitionId: 'nav', name: 'Primeiro', description: 'vem antes' },
      ...CRITERIA,
    ]
    const definitions = [...DEFINITIONS].reverse()
    const input = composeLlmInput({ ...PHASE_3_PARTS, definitions, criteria })

    const sequence = [
      PARTS.promptText,
      CODEBOOK_HEADING,
      `${DEFINITION_PREFIX}Transacional`,
      'A pessoa quer concluir uma ação.',
      `${DEFINITION_PREFIX}Informacional`,
      '- Pede explicação',
      `${DEFINITION_PREFIX}Navegacional`,
      'A pessoa quer chegar a um site específico.',
      '- Segundo: vem depois',
      '- Primeiro: vem antes',
      '- Cita o destino: a consulta nomeia o site',
      GENERAL_CRITERIA_HEADING,
      '- Uma intenção só: a consulta tem um objetivo',
      ITEM_HEADING,
      PARTS.itemContent,
    ]
    const positions = sequence.map((fragment) => input.indexOf(fragment))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('envia os critérios gerais uma vez só, num bloco com cabeçalho próprio', () => {
    const input = composeLlmInput({
      ...PHASE_3_PARTS,
      definitions: DEFINITIONS.slice(0, 2),
    })
    expect(occurrences(input, 'Uma intenção só')).toBe(1)
    expect(occurrences(input, GENERAL_CRITERIA_HEADING)).toBe(1)
    expect(input).toContain(
      `${GENERAL_CRITERIA_HEADING}\n- Uma intenção só: a consulta tem um objetivo`,
    )
  })

  it('sem critério geral, não envia o cabeçalho de gerais', () => {
    const input = composeLlmInput({
      ...PHASE_3_PARTS,
      criteria: CRITERIA.filter((criterion) => criterion.definitionId !== null),
    })
    expect(input).not.toContain(GENERAL_CRITERIA_HEADING)
    expect(input).toContain(
      `${DEFINITION_PREFIX}Transacional\nA pessoa quer concluir uma ação.\n\n${ITEM_HEADING}`,
    )
  })

  it('definição sem descrição vai direto do título para os critérios, sem linha vazia', () => {
    const input = composeLlmInput(PHASE_3_PARTS)
    expect(input).toContain(
      `${DEFINITION_PREFIX}Informacional\n${OWN_CRITERIA_HEADING}\n- Pede explicação`,
    )
    expect(input).not.toContain('\n\n\n')
    expect(input.split('\n').some((line) => line.length > 0 && line.trim() === '')).toBe(
      false,
    )
  })

  it('definição sem critério próprio não leva a linha de critérios', () => {
    const input = composeLlmInput(PHASE_3_PARTS)
    const paragraph = input
      .split('\n\n')
      .find((block) => block.startsWith(`${DEFINITION_PREFIX}Transacional`))
    expect(paragraph).toBe(`${DEFINITION_PREFIX}Transacional\nA pessoa quer concluir uma ação.`)
    expect(paragraph).not.toContain(OWN_CRITERIA_HEADING)
  })

  it('critério sem descrição vai só com o nome, sem os dois-pontos', () => {
    const input = composeLlmInput(PHASE_3_PARTS)
    const line = input.split('\n').find((candidate) => candidate.includes('Pede explicação'))
    expect(line).toBe('- Pede explicação')
  })

  it('preserva a formatação das descrições, sem normalizar', () => {
    const description = 'Primeira linha\n   linha recuada\n\tlinha com tabulação  '
    const criterionDescription = 'vale quando\n  há recuo'
    const input = composeLlmInput({
      ...PHASE_3_PARTS,
      definitions: [{ ...DEFINITIONS[0], description }],
      criteria: [{ definitionId: 'nav', name: 'Com recuo', description: criterionDescription }],
    })
    expect(input).toContain(`${DEFINITION_PREFIX}Navegacional\n${description}\n`)
    expect(input).toContain(`- Com recuo: ${criterionDescription}`)
  })
})

describe('composeLlmInput nunca envia o tipo da definição nem a escala', () => {
  const typeValues = DEFINITION_TYPE_OPTIONS.map((option) => option.value)
  const typeLabels = typeValues.map((value) => definitionTypeLabel(value)!)
  const scaleLabels = SCALE.map((value) => scaleLabel(value))

  it.each([PHASE_2, PHASE_3])('na Fase %i', (phase) => {
    const input = composeLlmInput({ ...PARTS, phase })
    for (const forbidden of [...typeValues, ...typeLabels, ...scaleLabels]) {
      expect(input).not.toContain(forbidden)
    }
  })
})
