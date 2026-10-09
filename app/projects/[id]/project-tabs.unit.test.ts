import { describe, it, expect } from 'vitest'
import { activeTab } from '@/app/projects/[id]/project-tabs'

const project = '11111111-1111-1111-1111-111111111111'
const path = (rest = '') => `/projects/${project}${rest}`

describe('app/projects/[id]/project-tabs — a aba ativa sai da rota', () => {
  it('a tela do projeto marca a visão geral', () => {
    expect(activeTab(path(), project)).toBe('overview')
  })

  it('cada tela de artefato marca a sua aba', () => {
    expect(activeTab(path('/codebook'), project)).toBe('codebook')
    expect(activeTab(path('/prompt'), project)).toBe('prompt')
    expect(activeTab(path('/items'), project)).toBe('items')
    expect(activeTab(path('/rounds'), project)).toBe('rounds')
    expect(activeTab(path('/evaluate'), project)).toBe('evaluate')
  })

  it('a tela de uma versão fica na aba do seu artefato', () => {
    expect(activeTab(path('/codebook/v1'), project)).toBe('codebook')
    expect(activeTab(path('/prompt/v1'), project)).toBe('prompt')
  })

  it('Membros e Ajustes marcam a sua aba', () => {
    expect(activeTab(path('/members'), project)).toBe('members')
    expect(activeTab(path('/settings'), project)).toBe('settings')
  })

  it('as subpáginas de onboarding ficam na aba de onde se chega a elas', () => {
    expect(activeTab(path('/profile-answers/u1'), project)).toBe('members')
    expect(activeTab(path('/questions'), project)).toBe('settings')
  })

  it('rota fora das abas não marca aba de artefato nenhuma', () => {
    expect(activeTab(path('/onboarding'), project)).toBe('overview')
  })
})
