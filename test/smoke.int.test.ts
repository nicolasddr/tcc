import { describe, it, expect, afterAll } from 'vitest'
import postgres from 'postgres'

// Smoke test do runner de integração: prova que o Vitest sobe, carrega a
// DATABASE_URL do `.env.local` e alcança o Postgres local. Não depende de
// `lib/db` de propósito — é o teste mais básico possível de conectividade.
// PRÉ-REQUISITO: `supabase start` (banco local na 54322), igual ao `npm test`.
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 })

afterAll(async () => {
  await sql.end()
})

describe('smoke: banco local', () => {
  it('conecta e responde a um SELECT trivial', async () => {
    const [row] = await sql<{ ok: number }[]>`select 1 as ok`
    expect(row.ok).toBe(1)
  })
})
