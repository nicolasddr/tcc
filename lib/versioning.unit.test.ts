import { describe, it, expect } from 'vitest'
import {
  decideSave,
  isVersionOpen,
  nextVersionNumber,
  type VersionSnapshot,
} from './versioning'

function version(
  versionNumber: number,
  usedAt: string | null = null,
  id = `v${versionNumber}`,
): VersionSnapshot {
  return { id, versionNumber, usedAt }
}

describe('isVersionOpen', () => {
  it('está em aberto quando nunca foi usada e é a mais recente', () => {
    const latest = version(3)
    expect(isVersionOpen(latest, latest)).toBe(true)
  })

  it('congela assim que é usada, mesmo sendo a mais recente', () => {
    const latest = version(3, '2026-08-25T12:00:00Z')
    expect(isVersionOpen(latest, latest)).toBe(false)
  })

  it('congela quando deixa de ser a mais recente, tenha sido usada ou não', () => {
    const latest = version(3)
    expect(isVersionOpen(version(2), latest)).toBe(false)
    expect(isVersionOpen(version(2, '2026-08-25T12:00:00Z'), latest)).toBe(false)
  })

  it('não considera nada em aberto quando o projeto não tem versão', () => {
    expect(isVersionOpen(version(1), null)).toBe(false)
  })
})

describe('nextVersionNumber', () => {
  it('o primeiro salvamento do projeto cria a versão 1', () => {
    expect(nextVersionNumber(null)).toBe(1)
  })

  it('cria o número imediatamente superior à maior existente', () => {
    expect(nextVersionNumber(version(1))).toBe(2)
    expect(nextVersionNumber(version(7, '2026-08-25T12:00:00Z'))).toBe(8)
  })
})

describe('decideSave', () => {
  it('sem versão nenhuma, cria a versão 1', () => {
    expect(decideSave(null, null)).toEqual({ mode: 'create', versionNumber: 1 })
  })

  it('em versão em aberto, atualiza a própria versão sem criar número novo', () => {
    const latest = version(2)
    expect(decideSave(latest, null)).toEqual({ mode: 'update', versionId: 'v2' })
    expect(decideSave(latest, 'v2')).toEqual({ mode: 'update', versionId: 'v2' })
  })

  it('em versão congelada pelo uso, cria a seguinte', () => {
    const latest = version(2, '2026-08-25T12:00:00Z')
    expect(decideSave(latest, null)).toEqual({ mode: 'create', versionNumber: 3 })
    expect(decideSave(latest, 'v2')).toEqual({ mode: 'create', versionNumber: 3 })
  })

  it('recusa quando o alvo não é a versão vigente', () => {
    expect(decideSave(version(3), 'v1')).toEqual({ mode: 'stale' })
    expect(decideSave(version(3, '2026-08-25T12:00:00Z'), 'v1')).toEqual({ mode: 'stale' })
    expect(decideSave(null, 'v1')).toEqual({ mode: 'stale' })
  })

  it('a decisão entre atualizar e criar não depende de quem chama, só do estado da versão', () => {
    const open = version(4)
    const frozen = version(4, '2026-08-25T12:00:00Z')
    expect(decideSave(open, null).mode).toBe('update')
    expect(decideSave(frozen, null).mode).toBe('create')
  })
})
