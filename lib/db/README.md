# `lib/db` — camada de acesso a dados (Drizzle)

O Drizzle é o **dono do schema**: `schema.ts` é a fonte da verdade das tabelas,
constraints, índices e FKs, e `drizzle-kit generate` gera o baseline SQL em
`supabase/migrations/`. Não há RLS, policies, triggers de negócio nem RPCs no banco — a
autorização vive na **camada de aplicação** (`lib/authz` + checagens explícitas nas
actions/páginas). Ver `docs/adr/0007-migracao-para-drizzle-orm.md`.

## Arquivos

- **`schema.ts`** — fonte da verdade do schema, **editado à mão**. Exceção documentada: o
  stub `usersInAuth` (tabela externa `auth.users`, do schema `auth` gerido pelo Supabase
  Auth) existe só para tipar a FK `profiles.id → auth.users.id`; o baseline **não** cria
  essa tabela.
- **`relations.ts`** — relações do Drizzle para as queries relacionais.
- **`index.ts`** — conexão. Existe uma única conexão (`ownerDb`, papel `postgres`, dono das
  tabelas). `transaction(run)` abre uma transação e roda `run` dentro dela. `pgErrorCode`
  desembrulha o SQLSTATE de um erro de escrita.

## Fluxo oficial: mudar o schema

O schema muda em `schema.ts`; o `drizzle-kit generate` produz a migration correspondente:

```bash
# precisa do Supabase local rodando (supabase start)
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' npx drizzle-kit generate
supabase db reset   # aplica o baseline + seed no banco local
```

Gotcha do `generate`: ele re-emite um `CREATE TABLE "auth"."users"` (o stub acima).
Remova esse `CREATE TABLE` da migration gerada à mão — a tabela já existe no schema `auth`.
