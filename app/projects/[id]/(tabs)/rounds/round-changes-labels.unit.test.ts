import { describe, it, expect } from 'vitest'
import * as labels from '@/app/projects/[id]/(tabs)/rounds/round-changes-labels'
import {
  CODEBOOK_AND_PROMPT_NOTICE,
  CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE,
  ENTERS_PHASE_3_NOTE,
  changesHeading,
  codebookChangeText,
  phaseChangeText,
  promptChangeText,
} from '@/app/projects/[id]/(tabs)/rounds/round-changes-labels'
import { roundInputSummary } from '@/app/projects/[id]/(tabs)/rounds/preconditions'
import { PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'

const JUDGEMENT_WORDS = [
  'melhor',
  'pior',
  'melhorou',
  'piorou',
  'boa',
  'ruim',
  'aprovad',
  'suficiente',
  'avançar',
  'fase 4',
]

const BLOCKING_WORDS = ['não pode abrir', 'bloque', 'trava', 'impede']

const changed = { changed: true, from: 3, to: 4 }
const unchanged = { changed: false, from: 4, to: 4 }

function allTexts(): string[] {
  const texts: string[] = []
  for (const value of Object.values(labels)) {
    if (typeof value === 'string') texts.push(value)
  }
  texts.push(changesHeading(3))
  for (const text of [codebookChangeText, promptChangeText, phaseChangeText]) {
    texts.push(text(changed), text(unchanged))
  }
  return texts
}

describe('app/projects/[id]/rounds/round-changes-labels — o que mudou na tela', () => {
  it('o cabeçalho diz a rodada de comparação', () => {
    expect(changesHeading(3)).toBe('Em relação à rodada 3')
  })

  it('cada linha diz as duas versões quando mudou e uma quando não mudou', () => {
    expect(codebookChangeText(changed)).toBe('Codebook: v3 → v4')
    expect(codebookChangeText(unchanged)).toBe('Codebook: v4, o mesmo')
    expect(promptChangeText({ changed: true, from: 1, to: 2 })).toBe('Prompt: v1 → v2')
    expect(promptChangeText({ changed: false, from: 2, to: 2 })).toBe('Prompt: v2, o mesmo')
    expect(phaseChangeText({ changed: true, from: 2, to: 3 })).toBe('Fase: 2 → 3')
    expect(phaseChangeText({ changed: false, from: 3, to: 3 })).toBe('Fase: 3, a mesma')
  })

  it('a frase da Fase 3 fala da forma de montar a entrada com as palavras da linha do que foi à LLM', () => {
    expect(ENTERS_PHASE_3_NOTE).toContain('forma de montar a entrada')
    expect(ENTERS_PHASE_3_NOTE).toContain('o codebook completo')
    expect(roundInputSummary(PHASE_3)).toContain('o codebook completo')
  })

  it('o aviso de codebook e prompt juntos não atribui a diferença a um nem ao outro', () => {
    expect(CODEBOOK_AND_PROMPT_NOTICE).toContain('não se atribui a um nem ao outro')
    expect(CODEBOOK_AND_PROMPT_NOTICE).toMatch(/ICR/)
    expect(CODEBOOK_AND_PROMPT_NOTICE).toContain('Qualidade')
  })

  it('a variante com a entrada também não atribui a diferença só à forma de montar a entrada', () => {
    expect(CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE).toContain('forma de montar a entrada')
    expect(CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE).toContain('não se atribui')
    expect(CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE).toContain('nem só à forma de montar a entrada')
  })

  it('a varredura alcança todas as frases exportadas', () => {
    expect(allTexts()).toEqual(
      expect.arrayContaining([
        CODEBOOK_AND_PROMPT_NOTICE,
        CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE,
        ENTERS_PHASE_3_NOTE,
      ]),
    )
  })

  it('nenhum texto julga a mudança', () => {
    for (const text of allTexts()) {
      for (const word of JUDGEMENT_WORDS) {
        expect(text.toLowerCase()).not.toContain(word)
      }
    }
  })

  it('nenhum texto proíbe ou trava nada', () => {
    for (const text of allTexts()) {
      for (const word of BLOCKING_WORDS) {
        expect(text.toLowerCase()).not.toContain(word)
      }
    }
  })

  it('nenhum texto menciona a Fase 4', () => {
    for (const text of allTexts()) {
      expect(text).not.toMatch(/Fase 4/i)
    }
  })
})
