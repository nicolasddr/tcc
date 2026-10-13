import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  NO_VERSION_EXPLANATION,
  VersionStatus,
  versionExplanation,
} from '@/app/projects/[id]/pipeline/version-status'

function wordsOf(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

describe('app/projects/[id]/pipeline/version-status — o ⓘ da versão', () => {
  it('a versão em aberto diz que salvar altera ela mesma até uma rodada usá-la, em até 25 palavras', () => {
    const text = versionExplanation(2, true)
    expect(wordsOf(text)).toBeLessThanOrEqual(25)
    expect(text).toContain('Salvar altera esta versão enquanto nenhuma rodada a usar')
    expect(text).toContain('ela congela')
    expect(text).toContain('cria a versão 3')
  })

  it('a versão congelada diz que não muda mais e que a próxima alteração copia o conteúdo dela', () => {
    const text = versionExplanation(2, false)
    expect(wordsOf(text)).toBeLessThanOrEqual(25)
    expect(text).toContain('não muda mais')
    expect(text).toContain('cria a versão 3, com o conteúdo copiado desta')
  })

  it('sem versão, o ⓘ diz que o primeiro salvamento cria a versão 1', () => {
    expect(wordsOf(NO_VERSION_EXPLANATION)).toBeLessThanOrEqual(25)
    expect(NO_VERSION_EXPLANATION).toContain('cria a versão 1')
  })
})

describe('app/projects/[id]/pipeline/version-status — a ação da linha da versão', () => {
  const action = createElement('button', { type: 'button' }, 'Editar')

  it('a ação aparece na mesma linha, depois do selo e do ⓘ', () => {
    const markup = renderToStaticMarkup(
      createElement(VersionStatus, { version: { versionNumber: 2 }, isOpen: true, action }),
    )
    const version = markup.indexOf('Versão 2')
    const badge = markup.indexOf('Em aberto')
    const tooltip = markup.indexOf('role="tooltip"')
    const button = markup.indexOf('>Editar</button>')
    expect(version).toBeGreaterThan(-1)
    expect(badge).toBeGreaterThan(version)
    expect(tooltip).toBeGreaterThan(badge)
    expect(button).toBeGreaterThan(tooltip)
  })

  it('sem ação, a linha não muda', () => {
    const markup = renderToStaticMarkup(
      createElement(VersionStatus, { version: { versionNumber: 2 }, isOpen: false }),
    )
    expect(markup).toContain('Congelada')
    expect(markup).not.toContain('<button type="button">')
  })
})
