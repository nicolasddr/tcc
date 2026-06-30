# `lib/db` — camada de acesso a dados (Drizzle)

Esta pasta contém **só artefatos de tipagem** + a **conexão RLS-aware**. A fonte da
verdade do schema e da RLS continua sendo `supabase/migrations/*.sql` (ver
`docs/adr/0007-migracao-para-drizzle-orm.md`). O Drizzle entra apenas para **tipar as
queries** — a segurança permanece no banco.

## Arquivos

- **`schema.ts`** / **`relations.ts`** — gerados por `drizzle-kit introspect` (lê o banco
  e gera os tipos). Não editar à mão, com **uma exceção documentada**: o stub
  `usersInAuth` (tabela externa `auth.users`) é adicionado manualmente porque o
  drizzle-kit referencia essa FK mas não gera a tabela (fica fora do `schemaFilter`).
- **`index.ts`** — conexão. Exporta `withUser(userId, run)`: a única porta para queries
  comuns. Abre uma transação, assume o papel `authenticated` e seta `request.jwt.claims`,
  de modo que **a RLS do banco vale** (igual aos testes pgTAP). O `baseDb` (papel
  `postgres`, que **fura a RLS**) é interno e não é exportado.

## ⚠️ Nunca rode `drizzle-kit generate` / `push` / `migrate`

Isso faria o Drizzle querer ser dono do schema e criaria uma **segunda fonte da verdade**,
conflitando com as migrations. Por isso esta pasta **não** versiona migrations do Drizzle
(`meta/`, `0000_*.sql` são apagados após o introspect).

## Regerar os tipos após mudar uma migration

```bash
# precisa do Supabase local rodando (supabase start) com as migrations aplicadas
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' npx drizzle-kit introspect
```

Depois confira se o stub `usersInAuth` em `schema.ts` sobreviveu (o introspect o sobrescreve;
reaplicar se necessário) e apague de novo `lib/db/meta/` e `lib/db/0000_*.sql`.
