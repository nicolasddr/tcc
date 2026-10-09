import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SCALE, scaleLabel, scaleRank } from '@/app/projects/[id]/(tabs)/evaluate/scale'
import { ScaleBadge, ScaleMarker } from '@/app/projects/[id]/(tabs)/evaluate/scale-marker'

const SEMAPHORE = /\b(?:bg|text|border)-(?:success|warning|danger)/

function count(markup: string, pattern: RegExp): number {
  return markup.match(pattern)?.length ?? 0
}

describe('app/projects/[id]/evaluate/scale-marker — o marcador da escala, sem semáforo', () => {
  it('são três barrinhas escondidas do leitor de tela, porque o rótulo já é texto', () => {
    for (const value of SCALE) {
      const markup = renderToStaticMarkup(createElement(ScaleMarker, { value }))
      expect(markup.startsWith('<span aria-hidden="true"')).toBe(true)
      expect(count(markup, /<span class="[^"]*block[^"]*"><\/span>/g)).toBe(3)
    }
  })

  it('enche tantas barras quanto o posto do valor, todas na mesma cor, e as outras ficam só no contorno', () => {
    for (const value of SCALE) {
      const markup = renderToStaticMarkup(createElement(ScaleMarker, { value }))
      expect(count(markup, /\bbg-quality-high\b/g)).toBe(scaleRank(value))
      expect(markup).not.toMatch(/bg-quality-(?:medium|low)/)
      expect(count(markup, /\bborder-line\b/g)).toBe(3 - scaleRank(value))
    }
  })

  it('não usa verde, amarelo nem vermelho', () => {
    for (const value of SCALE) {
      expect(renderToStaticMarkup(createElement(ScaleMarker, { value }))).not.toMatch(SEMAPHORE)
      expect(renderToStaticMarkup(createElement(ScaleBadge, { value }))).not.toMatch(SEMAPHORE)
    }
  })

  it('o selo leva o marcador e o rótulo, com o mesmo visual para os três valores', () => {
    const classes = SCALE.map((value) => {
      const markup = renderToStaticMarkup(createElement(ScaleBadge, { value }))
      expect(markup).toContain('aria-hidden="true"')
      expect(markup).toContain(`${scaleLabel(value)}</span>`)
      return /^<span class="([^"]*)"/.exec(markup)![1]
    })

    expect(new Set(classes).size).toBe(1)
  })
})
