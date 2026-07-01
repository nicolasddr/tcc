// Perguntas de onboarding (HU-026/027/029) — tipos e helpers neutros, compartilhados
// pelo gerenciamento do administrador (app/projects/[id]/questions) e pelo fluxo do
// avaliador (esta pasta). Sem 'use server'/'use client': é só dado + funções puras.

// Valor sentinela do rádio "Outro" na múltipla escolha (modelo Google Forms: o
// avaliador escolhe uma opção OU marca "Outro" e escreve o próprio texto). Nunca é
// gravado como resposta — quando selecionado, a resposta é o texto livre digitado.
export const OTHER_VALUE = '__other__'

export type OnboardingQuestionType = 'open' | 'multiple_choice'

// Formato serializável passado do Server Component para os forms client.
export type OnboardingQuestion = {
  id: string
  questionText: string
  questionType: OnboardingQuestionType
  options: string[] | null
}

// Normaliza o `options` (jsonb, tipado como unknown pelo Drizzle) para um array de
// strings — ou null quando não é uma lista de opções (pergunta aberta).
export function coerceOptions(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const opts = raw.filter((o): o is string => typeof o === 'string')
  return opts.length > 0 ? opts : null
}

// Converte o textarea "uma opção por linha" em array, descartando linhas vazias.
export function parseOptionsInput(raw: string): string[] {
  return raw
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean)
}
