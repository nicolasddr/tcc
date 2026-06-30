// lib/db/index.ts — conexão com o banco para o app.
//
// ⚠️ SERVER-ONLY: importa o driver `postgres` (TCP). Use só em Server Components e
// Server Actions; nunca em código que vá para o cliente.
//
// Regra de ouro (ver ADR 0007 e ./README.md): toda query comum passa por `withUser`,
// que roda sob o papel `authenticated` => a RLS do banco vale. O `baseDb` (papel
// `postgres`, dono das tabelas) FURA a RLS e por isso fica interno (não exportado).
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from './schema'
import * as relations from './relations'

// `prepare: false` é obrigatório com o pooler de transações do Supabase (prod, porta
// 6543) e inofensivo no banco local. Em dev o Next reavalia módulos a cada hot-reload;
// guardar o client no globalThis evita estourar o limite de conexões do Postgres.
const globalForDb = globalThis as unknown as { __dbClient?: ReturnType<typeof postgres> }
const client = globalForDb.__dbClient ?? postgres(process.env.DATABASE_URL!, { prepare: false })
if (process.env.NODE_ENV !== 'production') globalForDb.__dbClient = client

// INTERNO. Conecta como `postgres` (dono das tabelas) => BYPASSA a RLS. NÃO exportar
// para queries comuns; só a Fase 4 (RPCs privilegiadas) deve cogitar usá-lo.
const baseDb = drizzle(client, { schema: { ...schema, ...relations } })

// Tipo exato da transação que o callback recebe (evita um cast `as`).
type Transaction = Parameters<Parameters<typeof baseDb.transaction>[0]>[0]

/**
 * Executa `run` sob a identidade de `userId`, com a RLS ATIVA.
 *
 * Abre uma transação, seta `request.jwt.claims` (com `sub` = userId) e assume o papel
 * `authenticated` — exatamente o mecanismo do `tests.authenticate_as` do seed.sql. Como
 * é `set_config(..., is_local := true)`, tudo se reseta no fim da transação.
 *
 * Pegue o usuário com `supabase.auth.getUser()` (a autenticação continua no
 * @supabase/ssr) e passe `user.id` aqui.
 *
 * @example
 *   import { withUser, projects } from '@/lib/db'
 *   const rows = await withUser(user.id, (tx) => tx.select().from(projects))
 */
export async function withUser<T>(
  userId: string,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated' })
  return baseDb.transaction(async (tx) => {
    // `claims` vai parametrizado (mais seguro); 'authenticated' é literal fixo, nunca
    // input do usuário. set_config(role, ...) equivale a SET LOCAL ROLE.
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'authenticated', true)`,
    )
    return run(tx)
  })
}

/**
 * Extrai o SQLSTATE (ex.: '23505' = unique_violation, '42501' = RLS/insufficient
 * privilege) de um erro de escrita. O driver `postgres` lança um `PostgresError`
 * com o código em `.code`, mas o Drizzle o embrulha num `DrizzleQueryError` com o
 * original em `.cause` — então uma action que cheque `err.code` direto erraria.
 * Este helper desembrulha os dois formatos. Devolve `undefined` se não houver código.
 */
export function pgErrorCode(err: unknown): string | undefined {
  for (const candidate of [err, (err as { cause?: unknown } | null)?.cause]) {
    const code = (candidate as { code?: unknown } | null)?.code
    if (typeof code === 'string') return code
  }
  return undefined
}

// Reexporta o schema p/ consumidores: `import { withUser, projects } from '@/lib/db'`.
export * from './schema'
