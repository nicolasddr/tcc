import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FrozenNotice } from '@/app/projects/[id]/pipeline/frozen-notice'
import {
  FROZEN_RETURN_LINK,
  frozenLead,
  frozenMessage,
  type FrozenSubject,
} from '@/app/projects/[id]/pipeline/freeze'

const SUBJECTS: FrozenSubject[] = ['codebook', 'prompt']

function render(subject: FrozenSubject): string {
  return renderToStaticMarkup(createElement(FrozenNotice, { subject, projectId: 'p1' }))
}

function textOf(markup: string): string {
  return markup.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

describe('app/projects/[id]/pipeline/frozen-notice — o aviso de congelamento', () => {
  it.each(SUBJECTS)('o aviso do %s diz a mensagem inteira', (subject) => {
    expect(textOf(render(subject))).toBe(frozenMessage(subject))
  })

  it.each(SUBJECTS)(
    'no aviso do %s, "volte à Fase 3" é um link para o painel de voltar da Visão geral',
    (subject) => {
      const link = render(subject).match(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/)
      expect(link).toBeTruthy()
      expect(link![1]).toBe('/projects/p1#voltar')
      expect(link![2]).toBe(FROZEN_RETURN_LINK)
      expect(render(subject)).toContain(frozenLead(subject))
    },
  )

  it.each(SUBJECTS)('o aviso do %s é neutro, com cadeado', (subject) => {
    const markup = render(subject)
    expect(markup).toMatch(/^<p [^>]*class="[^"]*bg-surface-subtle/)
    expect(markup).toContain('<svg')
    expect(markup).not.toContain('warning')
  })
})
