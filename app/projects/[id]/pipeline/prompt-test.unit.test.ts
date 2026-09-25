import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  PromptTestResult,
  promptTestHint,
} from '@/app/projects/[id]/pipeline/prompt-test'
import {
  SENT_INPUT_MISSING,
  SENT_INPUT_SUMMARY,
} from '@/app/projects/[id]/(tabs)/rounds/sent-input'
import { PHASE_1, PHASE_2, PHASE_3 } from '@/app/projects/[id]/pipeline/preconditions'

const INPUT = 'Classifique a consulta.\n\n  linha recuada\n\nDefinições:\n- Urgência'
const OUTPUT = 'Categoria: urgência'

function render(opts: { input?: string; pending?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(PromptTestResult, {
      answer: {
        ok: true,
        nonce: 1,
        model: 'modelo-falso',
        output: OUTPUT,
        input: opts.input ?? INPUT,
      },
      pending: opts.pending ?? false,
    }),
  )
}

function unescapeHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
}

function preContentOf(markup: string): string {
  const match = markup.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)
  expect(match).toBeTruthy()
  return unescapeHtml(match![1])
}

describe('promptTestHint — o que a dica diz que vai à LLM', () => {
  it.each([PHASE_1, PHASE_2])('na Fase %i fala nos títulos das definições', (phase) => {
    const hint = promptTestHint(phase)
    expect(hint).toContain('títulos')
    expect(hint).not.toContain('codebook completo')
  })

  it('na Fase 3 fala no codebook completo, e não só nos títulos', () => {
    const hint = promptTestHint(PHASE_3)
    expect(hint).toContain('codebook completo')
    expect(hint).not.toContain('títulos das definições')
  })
})

describe('PromptTestResult — a entrada enviada junto com a saída', () => {
  it('mostra a entrada num bloco recolhido, acima da saída', () => {
    const markup = render()

    const details = markup.match(/<details[^>]*>/)
    expect(details).toBeTruthy()
    expect(details![0]).not.toMatch(/\bopen\b/)
    expect(markup).toMatch(new RegExp(`<summary[^>]*>[\\s\\S]*${SENT_INPUT_SUMMARY}[\\s\\S]*</summary>`))

    const detailsBody = markup.slice(markup.indexOf('<details'), markup.indexOf('</details>'))
    expect(detailsBody).toContain('<pre')

    expect(markup.indexOf('<details')).toBeLessThan(markup.indexOf(OUTPUT))
    expect(markup.indexOf('</details>')).toBeLessThan(markup.indexOf(OUTPUT))
  })

  it('a entrada aparece como veio, com quebras, recuo e linha em branco', () => {
    const input = 'linha um\r\n\n    recuo de quatro\ncom <tag> & "aspas" \n\nfim'
    expect(preContentOf(render({ input }))).toBe(input)
  })

  it('durante uma nova chamada, entrada e saída anteriores escurecem juntas', () => {
    const markup = render({ pending: true })

    const container = markup.match(/^<div[^>]*>/)
    expect(container).toBeTruthy()
    expect(container![0]).toContain('opacity-60')
    expect(container![0]).toContain('aria-busy="true"')
    expect(markup.endsWith('</div>')).toBe(true)
    expect(markup).toContain('Resposta do teste anterior (modelo-falso)')
    expect(preContentOf(markup)).toBe(INPUT)
    expect(markup).toContain(OUTPUT)
  })

  it('fora de uma chamada, o contêiner não escurece', () => {
    const container = render().match(/^<div[^>]*>/)![0]
    expect(container).not.toContain('opacity-60')
    expect(container).not.toContain('aria-busy')
  })

  it('não mostra a frase das respostas gravadas antes da entrada', () => {
    expect(render()).not.toContain(SENT_INPUT_MISSING)
  })
})
