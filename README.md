# tcc

Ferramenta de engenharia de prompt — Next.js + Supabase (Auth) + Postgres local via Drizzle.

## Pré-requisitos

- Node.js recente (Next 16 exige uma versão atual)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e aberto (roda o Postgres local)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)

## Setup local

1. Clonar e instalar dependências:

   ```bash
   git clone https://github.com/nicolasddr/tcc.git
   cd tcc
   npm install
   ```

2. Criar o `.env.local` a partir do exemplo:

   ```bash
   cp .env.example .env.local
   ```

   Preencher as 3 variáveis:

   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — peça esses valores pra quem já tem o projeto Supabase hospedado configurado (são chaves publishable/públicas, não precisam ser tratadas como segredo, mas não vão para o git).
   - `DATABASE_URL` — mesmo valor para qualquer pessoa rodando localmente: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

3. Com o Docker aberto, subir o Postgres local (já aplica as migrations versionadas em `supabase/migrations/`):

   ```bash
   supabase start
   ```

4. Rodar o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Abra [http://localhost:3000](http://localhost:3000).

5. Login com Google: o Auth aponta para o projeto Supabase hospedado, e a URL `http://localhost:3000/auth/callback` já está na allowlist de redirect desse projeto — funciona para qualquer pessoa rodando em `localhost:3000`, sem configuração extra.

**Nota:** o Auth (login) usa o Supabase hospedado, mas o banco de dados (Drizzle) é local — se o Docker/`supabase start` não estiver rodando, o login com Google conclui mas o app quebra ao tentar gravar o usuário no banco local.

## Setup opcional: rodar sem depender do Google (`/dev/login`)

O setup acima usa o Auth hospedado, então **depende do login com Google**. Para rodar o
app 100% na sua máquina — auth e banco locais — e entrar com um clique, existe um segundo
ambiente. É o que os testes E2E usam, e o que permite abrir as telas autenticadas num
navegador automatizado.

1. Gerar a signing key ES256 (fica só na sua máquina — é chave privada, gitignored).
   **Só na primeira vez**: rodar de novo sobrescreve a chave existente e invalida as
   sessões locais.

   ```bash
   supabase gen signing-key --algorithm ES256 | head -1 | sed 's/^/[/;s/$/]/' > supabase/signing_keys.json
   ```

2. Subir o stack local e criar o `.env.test.local`:

   ```bash
   supabase start
   cp .env.test.example .env.test.local
   ```

   Preencher as duas chaves com a saída de `supabase status` (elas são geradas por
   instalação — não copie as de outra máquina).

3. Rodar e entrar:

   ```bash
   npm run dev:local
   ```

   Abrir <http://localhost:3100/dev/login> — a sessão é criada na hora, sem Google. Use
   `?next=/alguma/rota` para cair direto numa tela.

Esse ambiente tem um **banco separado e vazio**: nada que você criou na `:3000` ou no app
publicado aparece aqui. A conta (`dev@test.local`) já nasce com permissão de criar
projetos e como super-admin da plataforma, então dá para percorrer o fluxo inteiro do
zero. Detalhes e limites de segurança da rota: [`e2e/README.md`](e2e/README.md).

## Scripts úteis

- `npm run dev` — servidor de desenvolvimento
- `npm run dev:local` — servidor na `:3100` contra o Supabase local (ver seção acima)
- `npm run build` / `npm run start` — build e start de produção
- `npm run lint` / `npm run typecheck` — checagens estáticas
- `npm test` — testes unitários e de integração (Vitest)
- `npm run test:unit` / `npm run test:int` — só unitários / só integração
- `npm run test:e2e` — testes end-to-end (Playwright)
- `npm run db:reset` — reseta o Postgres local (`supabase db reset`)
