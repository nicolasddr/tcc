import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Alert, type AlertTone } from '@/app/components/ui/alert'

function render(tone: AlertTone, icon?: React.ReactNode): string {
  return renderToStaticMarkup(Alert({ tone, icon, children: 'Projeto arquivado.' }))
}

function rootOf(markup: string): string {
  const root = markup.match(/^<p[^>]*>/)
  expect(root).toBeTruthy()
  return root![0]
}

function classesOf(tag: string): string[] {
  return (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/)
}

describe('app/components/ui/alert — o tom neutro', () => {
  it('o tom neutral é cinza: fundo sutil, borda de linha e texto de rótulo', () => {
    const classes = classesOf(rootOf(render('neutral')))
    expect(classes).toEqual(
      expect.arrayContaining(['bg-surface-subtle', 'border-line', 'text-label']),
    )
    expect(classes.some((name) => name.includes('warning'))).toBe(false)
  })

  it('o tom neutral não anuncia nada: sem role padrão', () => {
    expect(rootOf(render('neutral'))).not.toContain('role=')
  })

  it('o ícone vem antes do texto', () => {
    const markup = render('neutral', createElement('svg', { 'data-icon': 'lock' }))
    expect(markup.indexOf('data-icon="lock"')).toBeGreaterThan(-1)
    expect(markup.indexOf('data-icon="lock"')).toBeLessThan(markup.indexOf('Projeto arquivado.'))
  })

  it('sem ícone, o texto fica direto no parágrafo', () => {
    expect(render('neutral')).toMatch(/^<p[^>]*>Projeto arquivado\.<\/p>$/)
  })

  it('o tom notice continua amarelo', () => {
    const classes = classesOf(rootOf(render('notice')))
    expect(classes).toEqual(expect.arrayContaining(['bg-warning-bg', 'text-warning-fg']))
  })
})
