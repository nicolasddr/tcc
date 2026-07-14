import { defineConfig } from 'drizzle-kit'

// Config do drizzle-kit — usada SÓ pela CLI, nunca pelo app em runtime.
//
// Desde o flip da Fase 4 (issue #22) o Drizzle é DONO do schema: `lib/db/schema.ts` é a
// fonte da verdade e `drizzle-kit generate` produz as migrations em `supabase/migrations`,
// aplicadas por `supabase db reset` (que também roda o `seed.sql`). Isso INVERTE o fluxo
// antigo (introspecção a partir do SQL). Não há mais RLS/policies/triggers/RPCs no banco —
// a autorização vive na app-layer (lib/authz + checagens nas actions).
//
// Fluxo para mudar o schema: editar `schema.ts` → `npx drizzle-kit generate` → conferir o
// SQL gerado (removendo o `CREATE TABLE "auth"."users"` do stub externo, que já existe no
// schema auth do Supabase) → `supabase db reset`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  // Migrations geradas ficam junto das do Supabase, que é quem as aplica no banco local.
  out: './supabase/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['public'],
})
