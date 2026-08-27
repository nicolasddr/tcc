import 'server-only'

export const DEFAULT_LLM_MODEL = 'gpt-5.6-luna'

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

function outputText(payload: ResponsePayload): string {
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part): part is { type: string; text: string } =>
      part.type === 'output_text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('\n')
}

export async function askLlm(input: string): Promise<LlmAnswer> {
  const model = llmModel()
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('A chave da OpenAI não está configurada no servidor.')

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, input }),
  })

  if (!response.ok) {
    throw new Error(`A OpenAI respondeu com o status ${response.status}.`)
  }

  return { text: outputText((await response.json()) as ResponsePayload), model }
}
