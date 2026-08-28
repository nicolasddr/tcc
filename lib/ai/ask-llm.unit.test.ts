import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DEFAULT_LLM_TIMEOUT_MS, askLlm, llmTimeoutMs } from './index'
import { LlmError, type LlmFailure } from './failure'

const KEY = 'sk-teste-CHAVE-SECRETA-1234567890'

const ANSWER = {
  output: [{ content: [{ type: 'output_text', text: 'Categoria: Informacional' }] }],
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function respondWith(response: Response) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function rejectWith(cause: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit): Promise<Response> => {
    throw cause
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function failureOf(call: Promise<unknown>): Promise<LlmFailure> {
  try {
    await call
  } catch (cause) {
    expect(cause).toBeInstanceOf(LlmError)
    return (cause as LlmError).failure
  }
  throw new Error('a chamada não falhou')
}

describe('askLlm', () => {
  const env = { ...process.env }

  beforeEach(() => {
    process.env.OPENAI_API_KEY = KEY
    process.env.OPENAI_MODEL = 'modelo-de-teste'
    delete process.env.OPENAI_TIMEOUT_MS
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...env }
  })

  it('devolve o texto da resposta e o modelo usado na chamada', async () => {
    const fetchMock = respondWith(jsonResponse(200, ANSWER))

    expect(await askLlm('Classifique isto.')).toEqual({
      text: 'Categoria: Informacional',
      model: 'modelo-de-teste',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sem chave configurada, recusa como falha de autenticação e não chama o provedor', async () => {
    const fetchMock = respondWith(jsonResponse(200, ANSWER))
    delete process.env.OPENAI_API_KEY

    expect(await failureOf(askLlm('Classifique isto.'))).toBe('auth')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cada resposta de erro do provedor vira a sua família', async () => {
    const cases: [number, unknown, LlmFailure][] = [
      [401, { error: { code: 'invalid_api_key' } }, 'auth'],
      [404, { error: { code: 'model_not_found' } }, 'model'],
      [400, { error: { code: 'context_length_exceeded' } }, 'too_large'],
      [503, { error: { type: 'server_error' } }, 'unavailable'],
      [400, { error: { code: 'algo_que_ninguem_previu' } }, 'unknown'],
    ]

    for (const [status, payload, expected] of cases) {
      respondWith(jsonResponse(status, payload))
      expect(await failureOf(askLlm('Classifique isto.'))).toBe(expected)
    }
  })

  it('resposta de erro que nem é JSON não derruba a classificação', async () => {
    respondWith(new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    expect(await failureOf(askLlm('Classifique isto.'))).toBe('unavailable')
  })

  it('chamada encerrada por demora vira timeout, e não espera infinita', async () => {
    const timeout = new Error('The operation was aborted due to timeout')
    timeout.name = 'TimeoutError'
    rejectWith(timeout)

    expect(await failureOf(askLlm('Classifique isto.'))).toBe('timeout')
  })

  it('falha de rede vira indisponibilidade do provedor', async () => {
    rejectWith(new TypeError('fetch failed'))
    expect(await failureOf(askLlm('Classifique isto.'))).toBe('unavailable')
  })

  it('a chamada vai com prazo para terminar, configurável por variável de ambiente', async () => {
    const fetchMock = respondWith(jsonResponse(200, ANSWER))
    await askLlm('Classifique isto.')

    const init = fetchMock.mock.calls[0][1]
    expect(init.signal).toBeInstanceOf(AbortSignal)

    expect(llmTimeoutMs()).toBe(DEFAULT_LLM_TIMEOUT_MS)
    process.env.OPENAI_TIMEOUT_MS = '1500'
    expect(llmTimeoutMs()).toBe(1500)
    process.env.OPENAI_TIMEOUT_MS = 'depressa'
    expect(llmTimeoutMs()).toBe(DEFAULT_LLM_TIMEOUT_MS)
  })

  it('a chave vai só no cabeçalho da chamada, e nunca no erro devolvido', async () => {
    const fetchMock = respondWith(
      jsonResponse(401, {
        error: { message: `Incorrect API key provided: ${KEY}`, code: 'invalid_api_key' },
      }),
    )

    let raised: unknown
    try {
      await askLlm('Classifique isto.')
    } catch (cause) {
      raised = cause
    }

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${KEY}`)

    expect(raised).toBeInstanceOf(LlmError)
    const error = raised as LlmError
    expect(error.failure).toBe('auth')
    expect(error.message).not.toContain(KEY)
    expect(String(error.stack)).not.toContain(KEY)
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(KEY)
  })
})
