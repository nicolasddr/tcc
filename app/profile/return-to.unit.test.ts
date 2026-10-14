import { describe, it, expect } from 'vitest'
import { profileHref, projectIdOf, safeReturnPath } from './return-to'

const PROJECT = '3f2b6a1c-9d4e-4f7a-8b2c-1e5d6f7a8b9c'

describe('app/profile/return-to — de onde o usuário veio ao abrir o perfil', () => {
  it('leva a página atual, com a busca, no parâmetro from', () => {
    expect(profileHref(`/projects/${PROJECT}/evaluate`, 'item=2')).toBe(
      `/profile?from=%2Fprojects%2F${PROJECT}%2Fevaluate%3Fitem%3D2`,
    )
    expect(profileHref('/dashboard', '')).toBe('/profile?from=%2Fdashboard')
  })

  it('no próprio perfil, mantém o from que já estava na URL', () => {
    expect(profileHref('/profile', 'from=%2Fdashboard')).toBe('/profile?from=%2Fdashboard')
    expect(profileHref('/profile', '')).toBe('/profile')
  })

  it('aceita só caminhos internos da aplicação', () => {
    expect(safeReturnPath(`/projects/${PROJECT}/rounds?x=1`)).toBe(`/projects/${PROJECT}/rounds?x=1`)
    expect(safeReturnPath('/dashboard')).toBe('/dashboard')

    expect(safeReturnPath(undefined)).toBeNull()
    expect(safeReturnPath(['/dashboard', '/admin'])).toBeNull()
    expect(safeReturnPath('https://exemplo.com')).toBeNull()
    expect(safeReturnPath('//exemplo.com')).toBeNull()
    expect(safeReturnPath('/\\exemplo.com')).toBeNull()
    expect(safeReturnPath('/\t/exemplo.com')).toBeNull()
  })

  it('não volta para o próprio perfil nem para login e auth', () => {
    expect(safeReturnPath('/profile')).toBeNull()
    expect(safeReturnPath('/profile?from=%2Fdashboard')).toBeNull()
    expect(safeReturnPath('/login')).toBeNull()
    expect(safeReturnPath('/auth/callback')).toBeNull()
    expect(safeReturnPath('/profiles')).toBe('/profiles')
  })

  it('reconhece o projeto pelo caminho', () => {
    expect(projectIdOf(`/projects/${PROJECT}`)).toBe(PROJECT)
    expect(projectIdOf(`/projects/${PROJECT}/codebook/abc`)).toBe(PROJECT)
    expect(projectIdOf(`/projects/${PROJECT}?tab=1`)).toBe(PROJECT)
    expect(projectIdOf('/projects/new')).toBeNull()
    expect(projectIdOf('/dashboard')).toBeNull()
  })
})
