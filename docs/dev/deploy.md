# Deploy (produção)

Checklist para colocar o app no ar, com Vercel e Supabase cloud. Em produção o
`.env.local` não vale: auth e DB são os dois remotos, já que o DB local só existe
em dev (ver [performance.md](./performance.md)).

## Checklist

### 1. Allowlist do `/auth/callback` no Supabase

O login com Google usa o OAuth do Supabase: o botão chama
`signInWithOAuth({ redirectTo: <origin>/auth/callback })`, e
`app/auth/callback/route.ts` troca o code e redireciona para `/dashboard`.

Para isso funcionar, a URL exata de `redirectTo` precisa estar em
**Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**. O
`http://localhost:3000/auth/callback` já está configurado, para o dev. Ao
deployar, adicione a URL de produção (`https://<seu-dominio>/auth/callback`)
antes de testar o login.

Por quê: se a URL de `redirectTo` não está na allowlist, o Supabase a ignora e cai
no Site URL, que é a home. O client termina o login na home via
`detectSessionInUrl`, e o usuário tem a impressão de que logou mas ficou na mesma
página, com o botão inalterado, em vez de chegar ao `/dashboard`. É config de
dashboard, não bug de código.

Confira também o Site URL, que deve ser o domínio de produção.

### 2. Variáveis de ambiente na Vercel

Definir em Project Settings → Environment Variables, espelhando o
[`.env.example`](../../.env.example):

- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase cloud.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key do projeto cloud.
- `DATABASE_URL`: pooler de transações (ver o item 4).

### 3. Região da função igual à região do Supabase

Alinhe a região da função da Vercel à região do projeto Supabase. O default da
Vercel (`iad1`, US-East) diferente da região do Supabase (`sa-east-1`, São Paulo,
por exemplo) custava cerca de 1 s por navegação por causa dos round-trips
cross-continente, já que cada `transaction()` faz várias idas sequenciais ao
banco. É config de dashboard, sem código. O diagnóstico completo está em
[performance.md](./performance.md#3-latência-cross-region-em-produção-vercel--supabase).

### 4. `DATABASE_URL` com pooler de transações (porta 6543), nunca service_role

Em produção o `DATABASE_URL` deve apontar para o pooler de transações do Supabase,
na porta `6543`, com a senha do banco, e não com uma chave de API.

- O pooler de transações exige `prepare: false` no driver, o que já está
  configurado em `lib/db/index.ts` (e é inofensivo no banco local também).
- A segurança dos dados vem da app-layer, não da conexão. Não há RLS no banco
  depois do flip Drizzle-only, então a conexão única (`ownerDb`) é a dona das
  tabelas por desenho, e quem autoriza é o `lib/authz` mais o escopo explícito nas
  queries. Basta a senha do banco no `DATABASE_URL`; a `service_role`, que é chave
  de API do Supabase, não entra aqui. Ver a
  [ADR 0007](../adr/0007-migracao-para-drizzle-orm.md) e a
  [camada-de-dados.md](./camada-de-dados.md).

Formato (ver `.env.example`):

```
# Local:     postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Produção:  URL do pooler de transações (porta 6543), com a senha do banco
```

## Depois de deployar, verificar

1. Login com Google leva a `/dashboard` e não volta à home, o que confirma o item 1.
2. Navegação autenticada não leva cerca de 1 s por página, o que confirma o item 3.
3. Rotas protegidas redirecionam a `/login` quando o usuário está deslogado.
