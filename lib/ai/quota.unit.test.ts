import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_PROJECT_RESPONSES_MAX,
  countProjectResponse,
  hasProjectResponsesLeft,
  projectResponsesLeft,
  projectResponsesMax,
  projectResponsesUsed,
  resetProjectResponses,
} from './quota'

const PROJECT = 'projeto-a'
const OUTRO = 'projeto-b'

describe('teto de respostas por projeto', () => {
  const original = process.env.LLM_PROJECT_RESPONSES_MAX

  beforeEach(() => {
    resetProjectResponses()
    delete process.env.LLM_PROJECT_RESPONSES_MAX
  })
  afterEach(() => {
    resetProjectResponses()
    if (original === undefined) delete process.env.LLM_PROJECT_RESPONSES_MAX
    else process.env.LLM_PROJECT_RESPONSES_MAX = original
  })

  it('vem da variável de ambiente, com default do código quando ela não está posta', () => {
    expect(projectResponsesMax()).toBe(DEFAULT_PROJECT_RESPONSES_MAX)

    process.env.LLM_PROJECT_RESPONSES_MAX = '5'
    expect(projectResponsesMax()).toBe(5)

    process.env.LLM_PROJECT_RESPONSES_MAX = '0'
    expect(projectResponsesMax()).toBe(0)
  })

  it('valor inválido cai no default em vez de virar teto sem sentido', () => {
    for (const invalid of ['', '   ', 'muitas', '-3', '2.5']) {
      process.env.LLM_PROJECT_RESPONSES_MAX = invalid
      expect(projectResponsesMax()).toBe(DEFAULT_PROJECT_RESPONSES_MAX)
    }
  })

  it('conta por projeto, sem um projeto gastar o teto do outro', () => {
    process.env.LLM_PROJECT_RESPONSES_MAX = '2'

    countProjectResponse(PROJECT)
    expect(projectResponsesUsed(PROJECT)).toBe(1)
    expect(projectResponsesUsed(OUTRO)).toBe(0)
    expect(projectResponsesLeft(PROJECT)).toBe(1)
    expect(hasProjectResponsesLeft(OUTRO)).toBe(true)

    countProjectResponse(PROJECT)
    expect(hasProjectResponsesLeft(PROJECT)).toBe(false)
    expect(hasProjectResponsesLeft(OUTRO)).toBe(true)
  })

  it('nunca devolve saldo negativo depois do teto atingido', () => {
    process.env.LLM_PROJECT_RESPONSES_MAX = '1'
    countProjectResponse(PROJECT)
    countProjectResponse(PROJECT)

    expect(projectResponsesUsed(PROJECT)).toBe(2)
    expect(projectResponsesLeft(PROJECT)).toBe(0)
    expect(hasProjectResponsesLeft(PROJECT)).toBe(false)
  })

  it('teto zero recusa desde a primeira resposta', () => {
    process.env.LLM_PROJECT_RESPONSES_MAX = '0'
    expect(hasProjectResponsesLeft(PROJECT)).toBe(false)
  })
})
