import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { buttonClass } from '@/app/components/ui/button'

type ConfirmDialogProps = Parameters<typeof ConfirmDialog>[0]

function render(props: Partial<ConfirmDialogProps> = {}): string {
  return renderToStaticMarkup(
    createElement(
      ConfirmDialog,
      {
        trigger: () => createElement('button', { type: 'button' }, 'Remover'),
        title: 'Remover esta pergunta?',
        confirmLabel: 'Remover pergunta',
        action: async () => {},
        fields: { project_id: 'p1', question_id: 'q1' },
        ...props,
      },
      createElement('p', null, 'As respostas já dadas a ela também serão apagadas.'),
    ),
  )
}

function dialogOf(markup: string): string {
  const dialog = markup.match(/<dialog[\s\S]*<\/dialog>/)
  expect(dialog).toBeTruthy()
  return dialog![0]
}

function buttons(markup: string): { tag: string; label: string }[] {
  return [...markup.matchAll(/(<button[^>]*>)([^<]*)<\/button>/g)].map(([, tag, label]) => ({
    tag,
    label,
  }))
}

function attributeOf(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('app/components/ui/confirm-dialog — o diálogo de confirmação', () => {
  it('o gatilho fica fora do <dialog>', () => {
    const markup = render()
    const outside = markup.replace(dialogOf(markup), '')

    expect(buttons(outside).map((button) => button.label)).toEqual(['Remover'])
  })

  it('o <dialog> é rotulado pelo título', () => {
    const dialog = dialogOf(render())
    const labelledBy = attributeOf(dialog.match(/<dialog[^>]*>/)![0], 'aria-labelledby')

    expect(labelledBy).toBeTruthy()
    const title = dialog.match(new RegExp(`<h3[^>]*\\sid="${labelledBy}"[^>]*>([^<]*)</h3>`))
    expect(title?.[1]).toBe('Remover esta pergunta?')
  })

  it('o corpo fica dentro do <dialog>', () => {
    expect(dialogOf(render())).toContain('As respostas já dadas a ela também serão apagadas.')
  })

  it('oferece "Cancelar" e o botão de confirmar com o verbo da ação', () => {
    expect(buttons(dialogOf(render())).map((button) => button.label)).toEqual([
      'Cancelar',
      'Remover pergunta',
    ])
  })

  it('"Cancelar" é secundário e não envia', () => {
    const [cancel] = buttons(dialogOf(render()))

    expect(attributeOf(cancel.tag, 'type')).toBe('button')
    expect(attributeOf(cancel.tag, 'class')).toBe(buttonClass('secondary'))
  })

  it('o botão de confirmar envia o form com os campos ocultos', () => {
    const dialog = dialogOf(render())
    const form = dialog.match(/<form[\s\S]*<\/form>/)
    expect(form).toBeTruthy()

    expect(form![0]).toContain('<input type="hidden" name="project_id" value="p1"/>')
    expect(form![0]).toContain('<input type="hidden" name="question_id" value="q1"/>')
    const confirm = buttons(form![0]).find((button) => button.label === 'Remover pergunta')
    expect(attributeOf(confirm!.tag, 'type')).toBe('submit')
  })

  it('no tom padrão, o botão de confirmar é primary', () => {
    const [, confirm] = buttons(dialogOf(render()))

    expect(attributeOf(confirm.tag, 'class')).toBe(buttonClass('primary'))
  })

  it('com tone="danger", o botão de confirmar é dangerSolid', () => {
    const [, confirm] = buttons(dialogOf(render({ tone: 'danger' })))

    expect(attributeOf(confirm.tag, 'class')).toBe(buttonClass('dangerSolid'))
  })

  it('não sobrou confirm( do navegador em app, fora dos testes', () => {
    const app = resolve(__dirname, '../..')
    const offenders = sourceFiles(app).filter((path) =>
      /\bconfirm\(/.test(readFileSync(path, 'utf8')),
    )

    expect(offenders.map((path) => path.slice(app.length + 1))).toEqual([])
  })
})
