import 'server-only'
import { LlmError, classifyResponseFailure, classifyThrownFailure } from './failure'

export const DEFAULT_LLM_MODEL = 'gpt-5.6-luna'

export const DEFAULT_LLM_TIMEOUT_MS = 60_000

const ENDPOINT = 'https://api.openai.com/v1/responses'

export type LlmAnswer = {
  text: string
  model: string
}

type ResponsePart = { type?: string; text?: string }
type ResponseItem = { content?: ResponsePart[] }
type ResponsePayload = { output?: ResponseItem[] }

export function llmModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_LLM_MODEL
}

export function llmTimeoutMs(): number {
  const raw = process.env.OPENAI_TIMEOUT_MS?.trim()
  if (!raw) return DEFAULT_LLM_TIMEOUT_MS

  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LLM_TIMEOUT_MS

  return parsed
}

function outputText(payload: ResponsePayload): string {
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part): part is { type: string; text: string } =>
      part.type === 'output_text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('\n')
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function askLlm(input: string): Promise<LlmAnswer> {
  const model = llmModel()
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new LlmError('auth')

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(llmTimeoutMs()),
    })
  } catch (cause) {
    throw new LlmError(classifyThrownFailure(cause))
  }

  if (!response.ok) {
    throw new LlmError(classifyResponseFailure(response.status, await readJson(response)))
  }

  const payload = await readJson(response)
  if (!payload || typeof payload !== 'object') throw new LlmError('unknown')

  return { text: outputText(payload as ResponsePayload), model }
}
