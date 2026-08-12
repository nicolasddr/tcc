# Performance de navegação e latência de auth

Registro dos diagnósticos de lentidão de navegação e das correções aplicadas.
Foram três causas independentes, tratadas uma a uma: o throttle dos
`loading.tsx` (local), os round-trips ao Supabase Auth (`getUser` virando
`getClaims`) e a latência cross-region entre a função da Vercel e o Supabase
(produção).

## 1. `loading.tsx` e o throttle do React (o vilão em local)

Sintoma: toda navegação parecia lenta, porque a tela de esqueleto de loading
ficava mais tempo do que o servidor levava para responder. Dava para ver bem no
botão de criar projeto e no de voltar.

Causa raiz, confirmada e medida com o app rodando em navegador real: os
`loading.tsx` por rota combinados com o throttle do React
(`FALLBACK_THROTTLE_MS = 300` no react-dom). Quando um fallback de Suspense (o
`loading.tsx`) aparece, o React o mantém na tela por até 300 ms para evitar
flicker. Só que o servidor respondia o RSC em cerca de 30 ms, então o esqueleto
ficava uns 300 ms desnecessários e toda navegação parecia lenta, tanto em dev
quanto em prod.

Medições (prod, com token válido):

| Cenário | Tempo até o conteúdo |
| --- | --- |
| Com `loading.tsx` | ~310 ms |
| Sem `loading.tsx` | ~47 ms (23 a 78 ms) |

A resposta RSC do servidor levava cerca de 30 ms (TTFB entre 5 e 31 ms) e o DB
local entre 5 e 25 ms. Nada disso era o gargalo: o throttle era.

Fix aplicado no commit `ca138fa`: foram removidos os 7 `loading.tsx` (dashboard,
projects/new, profile, projects/[id] e as sub-rotas de onboarding, questions e
responses). Sem um loading boundary, o Next faz navegação "blocking", ou seja,
mantém a página atual pelos ~30 ms e a troca pelo conteúdo já pronto, o que
parece instantâneo.

Não confunda com o `app/projects/project-page-skeleton.tsx`. Esse é um fallback
de Suspense in-page, de streaming granular, e foi mantido de propósito junto com
o `skeleton.css`. O que causava o problema eram os `loading.tsx` de rota.

Para mitigar o trade-off, entrou uma top-loading-bar via `useLinkStatus()`,
abordagem documentada no Next 16. O wrapper drop-in
`app/components/app-link.tsx` substitui o `next/link` mantendo o mesmo
identificador `Link`, sem nenhuma mudança de JSX. O CSS em
`app/components/nav-progress.css` só mostra a barra (fixa no topo, com 3 px)
depois de uns 250 ms de pending, via `animation-delay`, de modo que navegações
rápidas nem chegam a exibi-la. Isso cobre as navegações client-side por `<Link>`;
os submits de server action já têm feedback de pending nos próprios botões.

## 2. Round-trips ao Supabase Auth: de `getUser()` para `getClaims()`

Problema: cada navegação ou submit autenticado fazia 2 round-trips de rede ao
Supabase Auth.

1. O `lib/supabase/proxy.ts` (o middleware) chamava `getUser()`, que valida e
   renova o token e reescreve cookies.
2. Cada página server e cada server action chamava `getUser()` de novo, só para
   obter o `user.id` (`sub`) usado nas queries e nos predicados de `lib/authz`.

Como em `.env.local` o auth é remoto mas o DB é local (`127.0.0.1`), esses
round-trips ao Auth na nuvem eram a única dependência remota no caminho, e eram
o que pesava.

O pré-requisito que torna a correção possível é o projeto usar chaves
assimétricas (JWKS em `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, com
`alg=ES256`). Por isso o `getClaims()` verifica a assinatura do JWT localmente,
via WebCrypto e com o JWKS cacheado pela auth-js, sem round-trip. Ele só cairia
em `getUser()`, com round-trip, se fosse HS256 ou se não houvesse `kid`.

Fase 1 (commit `7a85645`): helper `getClaims()` em `lib/supabase/server.ts`, que
devolve `JwtPayload | null`. Com `allowExpired:false`, um token vencido vira
não-logado e leva ao `redirect('/login')`, o que é seguro porque o proxy já
renovou o cookie antes, na mesma request. Cerca de 15 call sites, entre páginas e
actions, foram migrados: o bloco `getUser() + if(!user) redirect` virou
`getClaims()`, usando `claims.sub` onde antes se usava `user.id`, além de
`claims.email` e `claims.user_metadata` no dashboard.

Fase 2 (commit `9f5ac9a`): em `lib/supabase/proxy.ts`, dentro do `updateSession`,
o `await supabase.auth.getUser()` virou `await supabase.auth.getClaims()`. O
resultado continua descartado, porque o que importa é o efeito colateral: renovar
a sessão perto de expirar e propagar os cookies via `setAll`. Se o token não está
perto de expirar, ele devolve a sessão dos cookies sem rede e verifica a
assinatura localmente, com 0 round-trips; se está perto, o
`_callRefreshToken()` faz 1 chamada e reescreve os cookies, igual ao que o
`getUser()` fazia.

Atenção: não reuse o helper `getClaims()` de `lib/supabase/server.ts` dentro do
proxy. O proxy monta o próprio `createServerClient` com os adapters de cookie de
request e response (o `setAll` que reescreve o `supabaseResponse`), então a
chamada tem de ser ao `getClaims()` do client inline do proxy.

A segurança fica inalterada: o proxy continua renovando a sessão, o `getClaims`
verifica a assinatura em vez de confiar cegamente no cookie (é por isso que não
se usa `getSession` direto) e a autorização na app-layer, com `lib/authz` e
escopo explícito nas queries, segue valendo. Ver a
[ADR 0007](../adr/0007-migracao-para-drizzle-orm.md).

Resultado combinado: com token válido, uma navegação autenticada passa a ter 0
idas ao Supabase Auth. Existe uma regressão automatizada disso, o
`auth-roundtrips.spec.ts`, descrita em [testes-e2e.md](./testes-e2e.md).

Sobra um custo residual, ocasional: quando o token está perto de expirar (margem
de 90 s), o refresh (`POST /token`) é bloqueante contra o Auth na nuvem e leva de
200 a 600 ms (localmente, de 3 a 13 ms). Ele persiste, e corretamente, na ordem
de 1 refresh a cada 8 navegações, longe de ser "todo nav".

## 3. Latência cross-region em produção (Vercel ↔ Supabase)

Isto é diferente das causas 1 e 2. No deploy da Vercel o `.env.local` não vale,
então auth e DB são os dois remotos (o DB local só existe em dev).

Sintoma: cerca de 1 s por navegação mesmo na página mais simples, como
`projects/new`, que faz 1 query. No breakdown do request `?_rsc=`, o TTFB ficava
em ~320 ms (cold start mais o `getClaims` no Auth da nuvem) e o "download" em
~700 ms para um payload de 1,5 KB. Ou seja, era a resposta streamando enquanto
esperava o banco, e não banda.

Causa: a região da função na Vercel (o default `iad1`, US-East) era diferente da
região do Supabase (`sa-east-1`, São Paulo). Cada round-trip cross-continente
custa de 120 a 150 ms, e uma action que abre `transaction()` faz várias idas
sequenciais por chamada (`BEGIN`, query ou queries, `COMMIT`), o que dá o tal 1 s.

Fix: alinhar a região da função da Vercel à do projeto Supabase. É config de
dashboard, sem código, e o usuário confirmou que resolveu. O checklist está em
[deploy.md](./deploy.md).

A lição é que remover os `loading.tsx` foi certo para o ambiente local, onde o
servidor responde em ~30 ms e o throttle era o vilão, mas isso não toca a
latência cross-region da Vercel, que `loading.tsx` e Suspense apenas
mascarariam. As duas causas são independentes.

Ficaram de fora algumas otimizações de código, opcionais, caso a latência volte a
incomodar: cache de leituras quentes com `revalidate`, `<Suspense>` in-page para
streamar o dado lento, e cortar round-trips das transações e do refresh de auth.

## Armadilha de medição

O Playwright headless não hidrata este app: o WebSocket de HMR (`webpack-hmr`)
falha só no headless, então não há React fiber e o `<Link>` vira hard navigation.
Isso dá um falso diagnóstico de "hidratação quebrada". Para checar hidratação e
medir navegação client-side, use o preview ou um navegador real. Os detalhes
estão em [testes-e2e.md](./testes-e2e.md).
