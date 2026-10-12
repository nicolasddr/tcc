import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Section } from '@/app/components/ui/section'

const POINTS = ['Primeiro tópico.', 'Segundo tópico.'] as const

type SectionProps = Parameters<typeof Section>[0]

function render(props: Partial<Omit<SectionProps, 'children'>>): string {
  return renderToStaticMarkup(
    Section({
      title: 'Equipe',
      hint: 'Uma frase.',
      ...props,
      children: createElement('p', null, 'Conteúdo'),
    }),
  )
}

describe('app/components/ui/section — o "Saiba mais"', () => {
  it('os tópicos ficam numa lista dentro de um <details> fechado', () => {
    const markup = render({ more: { points: POINTS } })

    const details = markup.match(/<details[^>]*>[\s\S]*<\/details>/)
    expect(details).toBeTruthy()
    expect(details![0]).not.toMatch(/<details[^>]*\sopen/)
    expect(details![0]).toContain('Saiba mais')
    expect([...details![0].matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map(([, text]) => text)).toEqual(
      POINTS,
    )
  })

  it('o resumo pode ser trocado', () => {
    const markup = render({ more: { summary: 'Desativar ou marcar como outlier?', points: POINTS } })
    expect(markup).toMatch(/<summary[^>]*>[\s\S]*Desativar ou marcar como outlier\?<\/summary>/)
    expect(markup).not.toContain('Saiba mais')
  })

  it('aparece logo abaixo da dica e antes do conteúdo', () => {
    const markup = render({ more: { points: POINTS } })
    const hint = markup.indexOf('Uma frase.')
    const details = markup.indexOf('<details')
    const content = markup.indexOf('Conteúdo')
    expect(hint).toBeGreaterThan(-1)
    expect(details).toBeGreaterThan(hint)
    expect(content).toBeGreaterThan(details)
  })

  it('sem more, não há <details>', () => {
    expect(render({})).not.toContain('<details')
  })
})
