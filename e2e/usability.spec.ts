import { test, expect } from '@playwright/test'

// Usa a sessão injetada pelo global-setup (storageState). Estas specs cobrem o
// eixo USABILIDADE: com uma sessão válida, o usuário navega e nunca é jogado de
// volta ao /login, e nada estoura no browser.

test('sessão persiste ao navegar entre rotas autenticadas', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)

  // Navega por várias rotas protegidas — nenhuma pode redirecionar para /login.
  for (const route of ['/profile', '/projects/new', '/dashboard']) {
    await page.goto(route)
    await expect(page, `rota ${route} não deveria cair em /login`).not.toHaveURL(/\/login/)
  }

  // A home autenticada redireciona para o dashboard (app/page.tsx).
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('nenhuma exceção não-tratada durante a navegação autenticada', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))

  await page.goto('/dashboard')
  await page.goto('/profile')
  await page.goto('/projects/new')

  expect(pageErrors, `exceções no browser:\n${pageErrors.join('\n')}`).toHaveLength(0)
})
