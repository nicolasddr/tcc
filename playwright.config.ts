import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'

// Carrega o ambiente de teste (Supabase local). Ver .env.test.local.
loadEnv({ path: path.resolve(__dirname, '.env.test.local') })

// Porta dedicada de teste — evita colidir com o `next dev` normal (:3000) e com o
// callback OAuth allowlistado em :3000. Os cookies de auth são por host (127.0.0.1),
// independentes de porta, então isso não afeta a sessão injetada.
const PORT = 3100
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    storageState: 'e2e/.auth/user.json',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `next dev` na porta de teste, com o ambiente LOCAL injetado. Vars setados aqui
    // têm precedência sobre o .env.local do app (ver @next/env: só aplica arquivo se
    // a var NÃO existir no ambiente real) — por isso o app usa o Supabase local.
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      DATABASE_URL: process.env.DATABASE_URL!,
    },
  },
})
