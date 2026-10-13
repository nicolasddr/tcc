import { describe, it, expect } from 'vitest'
import { buttonClass } from '@/app/components/ui/button'

function classesOf(className: string): string[] {
  return className.split(/\s+/).filter(Boolean)
}

describe('app/components/ui/button — as variantes', () => {
  it('danger tem contorno vermelho em repouso e fundo vermelho claro no hover', () => {
    const classes = classesOf(buttonClass('danger'))

    expect(classes).toEqual(
      expect.arrayContaining([
        'border',
        'border-danger-border',
        'bg-surface',
        'text-danger-fg',
        'not-disabled:hover:bg-danger-tint',
      ]),
    )
    expect(classes).not.toContain('text-label')
    expect(classes).not.toContain('border-line-strong')
  })

  it('danger sm tem a mesma altura do secondary sm', () => {
    const danger = classesOf(buttonClass('danger', { size: 'sm' }))
    const secondary = classesOf(buttonClass('secondary', { size: 'sm' }))

    for (const sizing of ['px-3', 'py-[5px]', 'text-xs', 'border']) {
      expect(danger).toContain(sizing)
      expect(secondary).toContain(sizing)
    }
  })

  it('não há variante amarela nem a de texto vermelho sem padding', () => {
    expect(buttonClass('warning' as never)).not.toMatch(/warning/)
    expect(buttonClass('dangerGhost' as never)).not.toMatch(/danger/)
  })
})
