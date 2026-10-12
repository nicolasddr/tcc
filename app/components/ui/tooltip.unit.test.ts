import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { InfoTooltip } from '@/app/components/ui/tooltip'

const TEXT = 'Concordância entre avaliadores, de 0 a 1.'

function buttonOf(markup: string): string {
  const button = markup.match(/<button[^>]*>/)
  expect(button).toBeTruthy()
  return button![0]
}

function attributeOf(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

describe('app/components/ui/tooltip — o ⓘ', () => {
  it('o botão tem nome curto, e o texto chega como descrição pelo aria-describedby', () => {
    const markup = renderToStaticMarkup(createElement(InfoTooltip, { text: TEXT }))
    const button = buttonOf(markup)

    expect(attributeOf(button, 'aria-label')).toBe('Mais informações')
    expect(attributeOf(button, 'aria-label')).not.toContain(TEXT)

    const describedBy = attributeOf(button, 'aria-describedby')
    expect(describedBy).toBeTruthy()
    const tooltip = markup.match(/<span[^>]*role="tooltip"[^>]*>([^<]*)<\/span>/)
    expect(tooltip).toBeTruthy()
    expect(attributeOf(tooltip![0], 'id')).toBe(describedBy)
    expect(tooltip![1]).toBe(TEXT)
    expect(tooltip![0]).not.toContain('aria-hidden')
  })

  it('o nome do botão pode ser trocado pela prop label', () => {
    const markup = renderToStaticMarkup(
      createElement(InfoTooltip, { text: TEXT, label: 'O que é ICR?' }),
    )
    expect(attributeOf(buttonOf(markup), 'aria-label')).toBe('O que é ICR?')
  })

  it('começa fechado: aria-expanded falso e o balão fora do layout', () => {
    const markup = renderToStaticMarkup(createElement(InfoTooltip, { text: TEXT }))
    expect(attributeOf(buttonOf(markup), 'aria-expanded')).toBe('false')

    const tooltip = markup.match(/<span[^>]*role="tooltip"[^>]*>/)![0]
    expect(attributeOf(tooltip, 'class')!.split(' ')).toContain('hidden')
    expect(attributeOf(tooltip, 'class')).not.toContain('opacity-0')
  })

  it('o alvo do botão tem 24 × 24 px', () => {
    const markup = renderToStaticMarkup(createElement(InfoTooltip, { text: TEXT }))
    const classes = attributeOf(buttonOf(markup), 'class')!.split(' ')
    expect(classes).toContain('h-6')
    expect(classes).toContain('w-6')
  })
})
