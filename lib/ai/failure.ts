export type LlmFailure =
  | 'auth'
  | 'model'
  | 'too_large'
  | 'timeout'
  | 'unavailable'
  | 'unknown'

export class LlmError extends Error {
  readonly failure: LlmFailure

  constructor(failure: LlmFailure) {
    super(`llm_failure:${failure}`)
    this.name = 'LlmError'
    this.failure = failure
  }
}

const AUTH_CODES = [
  'invalid_api_key',
  'missing_api_key',
  'invalid_authentication',
  'account_deactivated',
]

const MODEL_CODES = ['model_not_found', 'unknown_model', 'invalid_model']

const TOO_LARGE_CODES = [
  'context_length_exceeded',
  'string_above_max_length',
  'max_tokens_exceeded',
]

const TOO_LARGE_HINTS = ['maximum context length', 'context_length', 'too long']

type ProviderError = {
  code?: unknown
  type?: unknown
  param?: unknown
  message?: unknown
}

function providerError(body: unknown): ProviderError {
  if (!body || typeof body !== 'object') return {}
  const error = (body as { error?: unknown }).error
  if (!error || typeof error !== 'object') return {}
  return error as ProviderError
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

export function classifyResponseFailure(status: number, body: unknown): LlmFailure {
  const error = providerError(body)
  const code = lower(error.code)
  const type = lower(error.type)
  const param = lower(error.param)
  const message = lower(error.message)

  const codes = [code, type]

  if (
    status === 413 ||
    codes.some((value) => TOO_LARGE_CODES.includes(value)) ||
    TOO_LARGE_HINTS.some((hint) => message.includes(hint))
  ) {
    return 'too_large'
  }

  if (status === 401 || status === 403 || codes.some((v) => AUTH_CODES.includes(v))) {
    return 'auth'
  }

  if (status === 404 || codes.some((v) => MODEL_CODES.includes(v)) || param === 'model') {
    return 'model'
  }

  if (status === 408 || status === 429 || status >= 500) return 'unavailable'

  return 'unknown'
}

export function classifyThrownFailure(cause: unknown): LlmFailure {
  if (cause instanceof LlmError) return cause.failure

  const name = cause instanceof Error ? cause.name : ''
  if (name === 'TimeoutError' || name === 'AbortError') return 'timeout'

  return 'unavailable'
}

export function llmFailureOf(cause: unknown): LlmFailure {
  return cause instanceof LlmError ? cause.failure : 'unknown'
}
