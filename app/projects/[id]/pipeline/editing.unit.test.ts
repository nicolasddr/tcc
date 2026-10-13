import { describe, it, expect } from 'vitest'
import { isEditing, savedNonceOf } from '@/app/projects/[id]/pipeline/editing'

const error = { error: 'O texto do prompt é obrigatório.' }
const saved = (nonce: number) => ({ ok: true as const, nonce })

describe('app/projects/[id]/pipeline/editing — o modo de edição do prompt e do codebook', () => {
  it('antes de clicar em editar, a tela fica em leitura', () => {
    expect(isEditing(null, null)).toBe(false)
  })

  it('editar antes do primeiro salvamento abre o formulário, e o erro mantém ele aberto', () => {
    const editingNonce = savedNonceOf(null)
    expect(isEditing(null, editingNonce)).toBe(true)
    expect(isEditing(error, editingNonce)).toBe(true)
  })

  it('o salvamento bem-sucedido volta à leitura, e editar de novo reabre', () => {
    expect(isEditing(saved(1), savedNonceOf(null))).toBe(false)
    expect(isEditing(saved(1), savedNonceOf(saved(1)))).toBe(true)
  })

  it('o erro depois de um salvamento bem-sucedido mantém o formulário aberto', () => {
    const editingNonce = savedNonceOf(saved(1))
    expect(isEditing(error, editingNonce)).toBe(true)
  })

  it('depois do erro, o próximo salvamento bem-sucedido volta à leitura', () => {
    const editingNonce = savedNonceOf(saved(1))
    expect(isEditing(saved(2), editingNonce)).toBe(false)
  })

  it('cancelar volta à leitura mesmo com o erro ainda no estado', () => {
    expect(isEditing(error, null)).toBe(false)
  })
})
