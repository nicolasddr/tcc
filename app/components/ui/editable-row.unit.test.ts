import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EditableRow } from '@/app/components/ui/editable-row'
import { buttonClass } from '@/app/components/ui/button'

type EditableRowProps = Parameters<typeof EditableRow>[0]

function render(props: Partial<EditableRowProps>): string {
  const all: EditableRowProps = {
    title: 'Informacional',
    expanded: false,
    onToggle: () => {},
    actions: createElement('span', null, 'AÇÕES'),
    footer: 'Esta definição vale 2 notas por resposta.',
    children: createElement('p', null, 'CORPO'),
    ...props,
  }
  return renderToStaticMarkup(createElement(EditableRow, all))
}

function toggleOf(markup: string): { tag: string; label: string } | null {
  const match = markup.match(/(<button[^>]*aria-expanded[^>]*>)([^<]*)<\/button>/)
  return match ? { tag: match[1], label: match[2] } : null
}

function attributeOf(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

describe('app/components/ui/editable-row — a linha editável', () => {
  it('fechada, mostra um "Editar" visível, secundário e pequeno, ligado ao painel', () => {
    const markup = render({})
    const toggle = toggleOf(markup)

    expect(toggle).toBeTruthy()
    expect(toggle!.label).toBe('Editar')
    expect(attributeOf(toggle!.tag, 'aria-expanded')).toBe('false')
    expect(attributeOf(toggle!.tag, 'class')).toBe(buttonClass('secondary', { size: 'sm' }))

    const panelId = attributeOf(toggle!.tag, 'aria-controls')
    expect(panelId).toBeTruthy()
    expect(markup).toContain(`id="${panelId}"`)
    expect(markup).not.toContain('sr-only')
  })

  it('o título não é botão, e o "Editar" vem antes das ações', () => {
    const markup = render({})
    expect(markup).not.toMatch(/<button[^>]*>[^<]*Informacional/)
    expect(markup.indexOf('>Editar</button>')).toBeLessThan(markup.indexOf('AÇÕES'))
  })

  it('o rótulo de abrir vem do expandLabel', () => {
    expect(toggleOf(render({ expandLabel: 'Ver conteúdo' }))!.label).toBe('Ver conteúdo')
  })

  it('aberta sem collapseLabel, o botão de abrir some', () => {
    const markup = render({ expanded: true })
    expect(toggleOf(markup)).toBeNull()
    expect(markup).not.toContain('>Editar</button>')
  })

  it('aberta com collapseLabel, o mesmo botão vira o de recolher', () => {
    const toggle = toggleOf(render({ expanded: true, collapseLabel: 'Recolher' }))
    expect(toggle).toBeTruthy()
    expect(toggle!.label).toBe('Recolher')
    expect(attributeOf(toggle!.tag, 'aria-expanded')).toBe('true')
  })

  it('o rodapé fica só com o texto, sem "Concluir edição"', () => {
    const markup = render({ expanded: true })
    expect(markup).toContain('Esta definição vale 2 notas por resposta.')
    expect(markup).not.toContain('Concluir edição')
    expect(markup.match(/<button/g) ?? []).toHaveLength(0)
  })
})
