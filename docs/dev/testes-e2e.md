# Testes E2E (Playwright)

O "como rodar" e a arquitetura da suíte vivem no
[`e2e/README.md`](../../e2e/README.md), junto do código dos testes. Este documento
registra o porquê e as armadilhas que não ficam óbvias ao ler os specs.

## O que a suíte cobre

- `e2e/usability.spec.ts`: com sessão válida, o usuário navega entre rotas
  protegidas e nunca é jogado ao `/login`, sem nenhuma exceção estourando no
  browser.
- `e2e/auth-roundtrips.spec.ts`: a regressão da Fase 2 (a troca de `getUser` por
  `getClaims` no `proxy.ts`, ver [performance.md](./performance.md)). Com token
  válido, navegar não pode gerar nenhum `GET /user` no Supabase Auth.

O app roda 100% contra o Supabase local, porque o `.env.test.local` aponta auth e
DB para `127.0.0.1`, diferente do `.env.local`, que usa auth remoto. As vars são
passadas via `webServer.env` do Playwright, que têm precedência sobre o
`.env.local`. O `global-setup.ts` cria o usuário de teste (admin, com service_role
local), faz login por senha e deixa a própria `@supabase/ssr` gerar os cookies
`sb-…-auth-token`, no mesmo formato do app, salvando o resultado como
`storageState`.

## Armadilhas

### 1. ES256 é pré-requisito, senão o teste de round-trips fica sem dente

O assert de "0 round-trips" só é fiel se o Supabase local emitir JWT assimétrico
(ES256), como o projeto remoto. Com HS256, que é o default do Supabase local, o
`getClaims()` cairia em `getUser()` e o teste daria falso-negativo: passaria
sempre, medindo a coisa errada.

Habilitar uma vez:

```sh
supabase gen signing-key --algorithm ES256 | head -1 | sed 's/^/[/;s/$/]/' > supabase/signing_keys.json
```

O `signing_keys.json` é gitignored, por ser chave privada, e já está habilitado em
`supabase/config.toml` via `signing_keys_path`. Repare que as chaves locais
(`PUBLISHABLE_KEY` e `SECRET_KEY`) mudam a cada `supabase db reset`, então
reconfira o `.env.test.local` com a saída de `supabase status`.

### 2. O GoTrue loga na stderr, não na stdout

O round-trip do `getUser` no proxy é server-side, dentro do Next, e portanto
invisível ao browser. Ele é medido pelos logs do container GoTrue local
(`supabase_auth_tcc`), filtrando `"path":"/user"` e `"method":"GET"`, no
`e2e/helpers/auth-log.ts`.

O cuidado é que o GoTrue escreve esses logs na stderr. A primeira versão do helper
usava `execFileSync`, que só captura stdout, e por isso contava sempre 0, deixando
o teste sem dente. A versão correta usa `spawnSync` juntando stdout e stderr, com
um modelo de baseline e delta: conta antes e depois da navegação, sem depender do
`docker logs --since`, que é frágil por causa do skew de relógio entre host e VM
no Docker Desktop.

A falsificação está comprovada: revertendo o proxy para `getUser()` o teste falha,
com N navegações gerando N round-trips; com `getClaims()`, passa em 0. O guard tem
dente.

### 3. O Playwright headless não hidrata este app

Em headless, o WebSocket de HMR (`webpack-hmr`) do `next dev` falha, o React não
hidrata e, sem fiber, o `<Link>` vira hard navigation. O resultado é que qualquer
teste que dependa de soft-navigation ou de estado client-side acusa uma
"hidratação quebrada" que não existe.

Por isso a suíte E2E mede o que é server-side, ou seja, os round-trips de auth
pelo log do GoTrue, e a ausência de erros e redirects, e não a qualidade da
hidratação. Para checar hidratação e medir navegação client-side, use o preview ou
um navegador real, não o Playwright headless. Ver
[performance.md](./performance.md).

## Rodar

```sh
supabase start          # auth + DB local precisam estar no ar
npm run test:e2e        # sobe o next dev na :3100 e roda a suíte
```

A porta 3100 evita colidir com a :3000 do dev normal, que é a que está na
allowlist do callback do Google OAuth (ver [deploy.md](./deploy.md)). Cookies de
auth são por host (`127.0.0.1`) e independem de porta. O `tsconfig` exclui `e2e/` e
`playwright.config.ts`, então o tsc e o eslint do app ficam intactos.
