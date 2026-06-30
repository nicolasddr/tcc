import { defineConfig } from 'drizzle-kit'

// Config do drizzle-kit — usada SÓ pela CLI (ex.: `drizzle-kit introspect`),
// nunca pelo app em runtime.
//
// IMPORTANTE (ver ADR 0007): neste projeto a fonte da verdade do schema e da RLS
// continua sendo `supabase/migrations/*.sql`. O Drizzle entra apenas para TIPAR as
// queries. Por isso usamos só o `introspect` (lê o banco e gera o schema TS).
// NÃO rode `drizzle-kit generate`/`push`: isso faria o Drizzle querer gerenciar o
// schema e criaria uma SEGUNDA fonte da verdade, conflitando com as migrations.
export default defineConfig({
  dialect: 'postgresql',
  // Arquivo TS gerado pela introspecção (entrada das queries tipadas do app).
  schema: './lib/db/schema.ts',
  // Pasta de saída da introspecção (schema.ts + relations.ts + snapshot).
  out: './lib/db',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Só o schema da aplicação; ignora auth/storage/etc. do Supabase.
  schemaFilter: ['public'],
  // Exclui as views internas do pgTAP (tap_funky, pg_all_foreign_keys) que o
  // seed.sql instala SÓ no banco local p/ os testes — não fazem parte do schema
  // do app e quebram a introspecção (tipos `unknown`). "*" mantém todo o resto.
  tablesFilter: ['*', '!tap_funky', '!pg_all_foreign_keys'],
})
