import { describe, it, expect } from 'vitest'
import {
  LlmError,
  classifyResponseFailure,
  classifyThrownFailure,
  llmFailureOf,
  type LlmFailure,
} from './failure'

function body(error: Record<string, unknown>): unknown {
  return { error }
}

describe('classifyResponseFailure', () => {
  it('separa a chave recusada do modelo desconhecido', () => {
    expect(classifyResponseFailure(401, body({ code: 'invalid_api_key' }))).toBe('auth')
    expect(classifyResponseFailure(403, null)).toBe('auth')
    expect(classifyResponseFailure(404, body({ code: 'model_not_found' }))).toBe('model')
    expect(classifyResponseFailure(400, body({ param: 'model' }))).toBe('model')
  })

  it('reconhece o item grande demais pelo código e pela mensagem do provedor', () => {
    expect(classifyResponseFailure(400, body({ code: 'context_length_exceeded' }))).toBe(
      'too_large',
    )
    expect(classifyResponseFailure(400, body({ code: 'string_above_max_length' }))).toBe(
      'too_large',
    )
    expect(
      classifyResponseFailure(
        400,
        body({ message: "This model's maximum context length is 128000 tokens." }),
      ),
    ).toBe('too_large')
    expect(classifyResponseFailure(413, null)).toBe('too_large')
  })

  it('trata excesso de requisições e erro do servidor como indisponibilidade', () => {
    expect(classifyResponseFailure(429, null)).toBe('unavailable')
    expect(classifyResponseFailure(500, null)).toBe('unavailable')
    expect(classifyResponseFailure(503, body({ type: 'server_error' }))).toBe('unavailable')
  })

  it('não chuta família quando o provedor não dá pista nenhuma', () => {
    expect(classifyResponseFailure(400, null)).toBe('unknown')
    expect(classifyResponseFailure(400, body({ code: 'algo_novo' }))).toBe('unknown')
    expect(classifyResponseFailure(400, 'resposta que nem é JSON de erro')).toBe('unknown')
  })

  it('o item grande demais ganha da leitura genérica de requisição inválida', () => {
    const payload = body({
      type: 'invalid_request_error',
      code: 'context_length_exceeded',
      param: 'input',
    })
    expect(classifyResponseFailure(400, payload)).toBe('too_large')
  })
})

describe('classifyThrownFailure', () => {
  it('chamada encerrada por demora vira timeout', () => {
    const timeout = new Error('The operation was aborted due to timeout')
    timeout.name = 'TimeoutError'
    expect(classifyThrownFailure(timeout)).toBe('timeout')

    const aborted = new Error('This operation was aborted')
    aborted.name = 'AbortError'
    expect(classifyThrownFailure(aborted)).toBe('timeout')
  })

  it('falha de rede vira indisponibilidade do provedor', () => {
    expect(classifyThrownFailure(new TypeError('fetch failed'))).toBe('unavailable')
    expect(classifyThrownFailure('quebrou')).toBe('unavailable')
  })

  it('preserva a família de um erro já classificado', () => {
    expect(classifyThrownFailure(new LlmError('too_large'))).toBe('too_large')
  })
})

describe('llmFailureOf', () => {
  it('devolve a família do erro da LLM e trata qualquer outro como desconhecido', () => {
    const families: LlmFailure[] = ['auth', 'model', 'too_large', 'timeout', 'unavailable']
    for (const family of families) {
      expect(llmFailureOf(new LlmError(family))).toBe(family)
    }
    expect(llmFailureOf(new Error('outra coisa'))).toBe('unknown')
    expect(llmFailureOf(undefined)).toBe('unknown')
  })

  it('a mensagem do erro não carrega texto vindo do provedor', () => {
    expect(new LlmError('auth').message).toBe('llm_failure:auth')
  })
})
