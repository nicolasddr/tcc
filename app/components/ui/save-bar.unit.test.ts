import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SaveBar } from '@/app/components/ui/save-bar'

type SaveBarProps = Parameters<typeof SaveBar>[0]

function render(props: Partial<SaveBarProps>): string {
  return renderToStaticMarkup(
    createElement(SaveBar, {
      dirty: false,
      changes: 'Alterações não salvas: 1 definição alterada.',
      onDiscard: () => {},
      ...props,
    }),
  )
}

function buttons(markup: string): { tag: string; label: string }[] {
  return [...markup.matchAll(/(<button[^>]*>)([^<]*)<\/button>/g)].map(([, tag, label]) => ({
    tag,
    label,
  }))
}

function isDisabled(tag: string): boolean {
  return /\sdisabled=""/.test(tag)
}

describe('app/components/ui/save-bar — a barra de salvar', () => {
  it('sem alteração, diz "Nenhuma alteração.", oferece "Cancelar" e o "Salvar" fica desabilitado', () => {
    const markup = render({ dirty: false })

    expect(markup).toContain('Nenhuma alteração.')
    expect(markup).not.toContain('Alterações não salvas')
    expect(buttons(markup).map((button) => button.label)).toEqual(['Cancelar', 'Salvar'])

    const [cancel, save] = buttons(markup)
    expect(isDisabled(cancel.tag)).toBe(false)
    expect(isDisabled(save.tag)).toBe(true)
    expect(save.tag).toContain('type="submit"')
  })

  it('com alteração, mostra a frase do que mudou, oferece "Descartar" e o "Salvar" fica habilitado', () => {
    const markup = render({ dirty: true })

    expect(markup).toContain('Alterações não salvas: 1 definição alterada.')
    expect(markup).not.toContain('Nenhuma alteração.')
    expect(buttons(markup).map((button) => button.label)).toEqual(['Descartar', 'Salvar'])

    const [discard, save] = buttons(markup)
    expect(isDisabled(discard.tag)).toBe(false)
    expect(isDisabled(save.tag)).toBe(false)
  })

  it('o rótulo de salvar pode ser trocado', () => {
    const markup = render({ dirty: true, saveLabel: 'Cadastrar' })
    expect(buttons(markup).map((button) => button.label)).toEqual(['Descartar', 'Cadastrar'])
  })
})
