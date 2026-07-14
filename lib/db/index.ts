// lib/db/index.ts — conexão com o banco para o app.
//
// ⚠️ SERVER-ONLY: importa o driver `postgres` (TCP). Use só em Server Components e
// Server Actions; nunca em código que vá para o cliente.
//
// Desde o flip da Fase 4 (issue #22) NÃO há mais RLS no banco: a autorização vive na
// app-layer (lib/authz + checagens explícitas nas actions). Existe uma única conexão
// (papel `postgres`, dono das tabelas); `withUser` virou um wrapper de transação simples.
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import * as relations from './relations'

// `prepare: false` é obrigatório com o pooler de transações do Supabase (prod, porta
// 6543) e inofensivo no banco local. Em dev o Next reavalia módulos a cada hot-reload;
// guardar o client no globalThis evita estourar o limite de conexões do Postgres.
const globalForDb = globalThis as unknown as { __dbClient?: ReturnType<typeof postgres> }
const client = globalForDb.__dbClient ?? postgres(process.env.DATABASE_URL!, { prepare: false })
if (process.env.NODE_ENV !== 'production') globalForDb.__dbClient = client

// Conexão única (papel `postgres`, dono das tabelas). Sem RLS no banco, não há mais
// distinção entre papel privilegiado e papel do usuário — toda query roda por aqui.
const baseDb = drizzle(client, { schema: { ...schema, ...relations } })

// Tipo exato da transação que os callbacks recebem (evita um cast `as`).
export type Transaction = Parameters<Parameters<typeof baseDb.transaction>[0]>[0]

// Executor aceito pelas funções que recebem a conexão base OU uma transação.
export type DbExecutor = typeof baseDb | Transaction

// Conexão do app. Usada por `lib/authz`, pelas actions e pelos helpers de teste.
export const ownerDb = baseDb

/**
 * Abre uma transação e executa `run` dentro dela. Sem RLS no banco (flip da Fase 4,
 * issue #22), é um wrapper de transação simples — não troca de papel nem seta claims. A
 * autorização é feita na app-layer, ANTES/JUNTO da query (ver lib/authz e as checagens
 * nas actions).
 *
 * @example
 *   import { transaction, projects } from '@/lib/db'
 *   const rows = await transaction((tx) => tx.select().from(projects))
 */
export async function transaction<T>(
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return baseDb.transaction(run)
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
