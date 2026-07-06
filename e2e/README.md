# Testes E2E (Playwright)

Testes de **usabilidade** e **latência de auth** que rodam o app de verdade num
browser, com uma sessão autenticada real — **sem** passar pela tela do Google.

## O que cobrem

- `usability.spec.ts` — com sessão válida, o usuário navega entre rotas protegidas
  e nunca é jogado ao `/login`; nenhuma exceção estoura no browser.
- `auth-roundtrips.spec.ts` — **regressão da Fase 2** (`getUser → getClaims` no
  `proxy.ts`): com token válido, navegar não pode gerar nenhum `GET /user` no
  Supabase Auth. Esse round-trip é server-side (no Next), então é medido pelo log
  do container GoTrue local — ver `helpers/auth-log.ts`.
  > Comprovado que o teste tem dente: revertendo o proxy para `getUser()`, ele
  > falha (N navegações → N round-trips).

## Como funciona

- O app roda 100% contra o **Supabase local** (`.env.test.local` aponta auth+DB
  para `127.0.0.1`), diferente do `.env.local` (auth remoto). Os vars são passados
  via `webServer.env` do Playwright, que têm precedência sobre o `.env.local`.
- `global-setup.ts` cria o usuário de teste (admin/service_role local), faz login
  por senha e deixa a **própria `@supabase/ssr`** gerar os cookies
  `sb-…-auth-token` (mesmo formato/chunking do app) → salva como `storageState`.

## Pré-requisitos (one-time)

O assert de "0 round-trips" só é fiel se o Supabase local emitir **JWT assimétrico
(ES256)**, como o projeto remoto. Com HS256 (default), `getClaims()` cairia em
`getUser()` e o teste daria falso-negativo. Por isso:

1. Gerar a signing key ES256 (gitignored — chave privada):
   ```sh
   supabase gen signing-key --algorithm ES256 | head -1 | sed 's/^/[/;s/$/]/' > supabase/signing_keys.json
   ```
   (já habilitada em `supabase/config.toml` via `signing_keys_path`).
2. Subir o stack local: `supabase start`.
3. Conferir/atualizar as chaves em `.env.test.local` com a saída de
   `supabase status` (o `PUBLISHABLE_KEY`/`SECRET_KEY` mudam a cada `db reset`
   com signing keys novas).

## Rodar

```sh
supabase start          # precisa estar no ar (auth + DB local)
npm run test:e2e        # sobe o next dev na :3100 e roda a suíte
```
