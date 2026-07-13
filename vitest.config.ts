import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Testes de INTEGRAÇÃO da camada de dados/autorização: rodam contra o Supabase
// LOCAL (mesma exigência do pgTAP — `supabase start` precisa estar de pé). Por
// isso o padrão é `*.int.test.ts` e a suíte roda em série (sem paralelismo de
// arquivos): cada teste mexe no mesmo banco e evita tempestade de conexões.
export default defineConfig({
  resolve: {
    // Espelha o alias `@/*` do tsconfig.json para o Vitest resolver `@/lib/...`.
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.int.test.ts'],
    fileParallelism: false,
  },
})
