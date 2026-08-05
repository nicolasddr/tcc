// Testes do guard do login de desenvolvimento. É a peça de segurança da rota
// `/dev/login`: se `checkDevLogin()` devolver `ok` num ambiente que não seja o local, a
// rota passa a emitir sessão sem credencial onde não devia. Daí a cobertura ser sobre os
// casos que ela precisa RECUSAR.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { checkDevLogin } from './session'

/** Ambiente local completo — cada teste estraga um pedaço de propósito. */
function stubLocalEnv(over: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local',
    SUPABASE_SECRET_KEY: 'sb_secret_local',
    E2E_USER_EMAIL: 'teste@exemplo.com',
    E2E_USER_PASSWORD: 'senha-de-teste',
    ...over,
  }
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('checkDevLogin', () => {
  it('libera com o ambiente local completo', () => {
    stubLocalEnv()
    const check = checkDevLogin()
    expect(check.ok).toBe(true)
  })

  it('aceita localhost além de 127.0.0.1', () => {
    stubLocalEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' })
    expect(checkDevLogin().ok).toBe(true)
  })

  // O guard central: é ele que garante que a rota não alcança dados reais mesmo que
  // vá parar num deploy.
  it('recusa quando o Supabase não é local', () => {
    stubLocalEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://abcdef.supabase.co' })
    const check = checkDevLogin()
    expect(check.ok).toBe(false)
    expect(check.ok === false && check.reason).toMatch(/não é local/)
  })

  it('recusa host que apenas contém "localhost"', () => {
    stubLocalEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://localhost.atacante.com' })
    expect(checkDevLogin().ok).toBe(false)
  })

  it('recusa em build de produção, mesmo apontando para o Supabase local', () => {
    stubLocalEnv()
    vi.stubEnv('NODE_ENV', 'production')
    const check = checkDevLogin()
    expect(check.ok).toBe(false)
    expect(check.ok === false && check.reason).toMatch(/production/)
  })

  it('recusa sem as credenciais do usuário de teste', () => {
    stubLocalEnv({ E2E_USER_EMAIL: undefined, E2E_USER_PASSWORD: undefined })
    expect(checkDevLogin().ok).toBe(false)
  })

  it('recusa sem a URL/chave do Supabase', () => {
    stubLocalEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined })
    expect(checkDevLogin().ok).toBe(false)
  })

  it('recusa URL malformada', () => {
    stubLocalEnv({ NEXT_PUBLIC_SUPABASE_URL: 'nao-e-url' })
    expect(checkDevLogin().ok).toBe(false)
  })

  // A service_role só serve para CRIAR o usuário de teste; sem ela o login ainda
  // funciona se o usuário já existir.
  it('libera sem service_role, deixando secretKey indefinida', () => {
    stubLocalEnv({ SUPABASE_SECRET_KEY: undefined })
    const check = checkDevLogin()
    expect(check.ok).toBe(true)
    expect(check.ok === true && check.config.secretKey).toBeUndefined()
  })
})
