import { test, expect } from '@playwright/test'
import { countGetUserTotal } from './helpers/auth-log'

// Eixo LATÊNCIA / regressão da Fase 2. O proxy.ts roda em TODA navegação. Antes
// (getUser) cada request fazia um round-trip ao Supabase Auth (GET /user). Depois
// (getClaims) o JWT ES256 é verificado localmente → zero idas ao Auth com token
// válido. Como esse round-trip é server-side, medimos pelo log do GoTrue local.

test('navegação autenticada não faz round-trip ao Auth (getUser)', async ({ page }) => {
  // Aquece: primeira request pode buscar o JWKS (não é /user) e compilar a rota.
  await page.goto('/dashboard')
  await expect(page, 'sessão precisa estar válida — senão o teste passaria à toa').toHaveURL(
    /\/dashboard$/
  )

  const before = countGetUserTotal()

  // Várias navegações protegidas — cada uma passa pelo proxy.ts.
  const routes = ['/profile', '/projects/new', '/dashboard', '/profile']
  for (const route of routes) {
    await page.goto(route)
    await expect(page).not.toHaveURL(/\/login/)
  }

  const roundTrips = countGetUserTotal() - before
  expect(
    roundTrips,
    `esperado 0 GET /user no Auth com token válido (getClaims), mas ${routes.length} navegações ` +
      `geraram ${roundTrips} — possível regressão para getUser() no proxy.ts.`
  ).toBe(0)
})
